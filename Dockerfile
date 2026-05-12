# =============================================================================
# Planner Studio 3D Configurator — Production Dockerfile
# Multi-stage build: Composer (deps) → Node + PHP (frontend) → PHP-FPM + Nginx
# Target image size: ~120-140 MB (Alpine-based)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Composer Dependencies
# Installs PHP vendor packages without dev dependencies.
# Must run FIRST — the frontend stage needs /vendor for Wayfinder.
# ---------------------------------------------------------------------------
FROM composer:2 AS composer-deps

WORKDIR /build

# 1. Copy dependency manifests first (maximizes layer cache hits)
COPY composer.json composer.lock ./

# 2. Install production dependencies only
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --no-autoloader \
    --prefer-dist

# 3. Copy application source for autoloader generation
COPY . .

# 4. Generate optimized autoloader with full class map
RUN composer dump-autoload --optimize --no-dev

# ---------------------------------------------------------------------------
# Stage 2: Frontend Build
# Compiles Vue.js/TypeScript/Three.js via Vite into static assets.
# Requires PHP CLI because @laravel/vite-plugin-wayfinder executes
# `php artisan wayfinder:generate` during the build, which boots Laravel
# and needs PDO + a database driver to resolve service providers.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend-build

WORKDIR /build

# 1. Install PHP CLI + extensions needed to fully boot Laravel Artisan
#    - php84-pdo + php84-pdo_sqlite: Wayfinder boots the app, which resolves
#      database service providers and requires a PDO driver even if unused.
#    - We use SQLite in-memory during build to avoid needing a real DB.
RUN apk add --no-cache \
    php84 \
    php84-cli \
    php84-mbstring \
    php84-xml \
    php84-phar \
    php84-openssl \
    php84-tokenizer \
    php84-dom \
    php84-xmlwriter \
    php84-fileinfo \
    php84-session \
    php84-ctype \
    php84-pdo \
    php84-pdo_sqlite \
    && ln -sf /usr/bin/php84 /usr/bin/php

# 2. Copy dependency manifests first (maximizes layer cache hits)
COPY package.json package-lock.json ./

# 3. Install ALL npm dependencies (devDeps include vite, tailwindcss, vue plugin)
RUN npm ci

# 4. Copy full application source (Laravel needs it for artisan boot)
COPY . .

# 5. Copy vendor from composer-deps stage (Wayfinder needs it)
COPY --from=composer-deps /build/vendor ./vendor

# 6. Prepare a minimal .env for artisan boot during the Vite build.
#    Uses SQLite in-memory so no real database is needed.
RUN cp .env.example .env 2>/dev/null || true \
    && sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env \
    && sed -i 's/^DB_DATABASE=.*/#DB_DATABASE=/' .env \
    && php artisan key:generate --no-interaction 2>/dev/null || true

# 7. Build frontend — Vite compiles assets + Wayfinder generates routes
RUN npx vite build

# ---------------------------------------------------------------------------
# Stage 3: Production Runtime
# Minimal Alpine image with PHP-FPM, Nginx, and Supervisord
# ---------------------------------------------------------------------------
FROM php:8.4-fpm-alpine AS production

LABEL maintainer="Victor Hanert"
LABEL description="Planner Studio 3D Configurator"

# Install system dependencies and PHP extensions
RUN apk add --no-cache \
        nginx \
        supervisor \
        curl \
    && docker-php-ext-install \
        pdo_mysql \
        opcache \
        pcntl \
    && rm -rf /var/cache/apk/* /tmp/*

# Create www-data user if not exists (Alpine uses nginx user by default)
RUN addgroup -g 82 -S www-data 2>/dev/null || true \
    && adduser -u 82 -D -S -G www-data www-data 2>/dev/null || true

# --- Configuration Files ---

# PHP production config (OPcache + JIT + security)
COPY docker/php/php-production.ini /usr/local/etc/php/conf.d/99-production.ini

# PHP-FPM pool config (tuned for B1 App Service)
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf

# Nginx site config (cache headers for .glb/.gltf, gzip for JSON)
COPY docker/nginx/default.conf /etc/nginx/http.d/default.conf

# Supervisord config (PHP-FPM + Nginx + Queue Worker)
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Container entrypoint (migrations, caching, permissions)
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# --- Application Code ---

WORKDIR /var/www/html

# Copy Composer vendor dependencies from stage 1
COPY --from=composer-deps /build/vendor ./vendor

# Copy application source code
COPY . .

# Copy Vite build output from stage 2 (overwrites placeholder in public/)
COPY --from=frontend-build /build/public/build ./public/build

# --- Permissions ---

# Ensure storage and cache directories are writable
RUN mkdir -p storage/framework/{cache,sessions,views} \
    && mkdir -p storage/logs \
    && mkdir -p bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# --- Health Check ---
# Azure App Service uses this to determine container readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/up || exit 1

EXPOSE 80

ENTRYPOINT ["entrypoint.sh"]
