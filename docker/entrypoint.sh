#!/bin/sh
set -e

echo "============================================="
echo "  Planner Studio — Container Startup"
echo "============================================="

# Ensure storage directories exist with correct permissions
echo "[entrypoint] Setting up storage directories..."
mkdir -p /var/www/html/storage/framework/{cache,sessions,views}
mkdir -p /var/www/html/storage/logs
mkdir -p /var/www/html/bootstrap/cache
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Cache configuration, routes, and views for production performance
echo "[entrypoint] Caching Laravel configuration..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Run database migrations (safe for production — uses --force)
echo "[entrypoint] Running database migrations..."
php artisan migrate --force --no-interaction

echo "[entrypoint] Startup complete. Launching Supervisord..."
echo "============================================="

# Hand off to Supervisord (PID 1)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
