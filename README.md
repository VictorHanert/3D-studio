# The Planner Studio - Bachelor Project 2026

A 3D configurator built with **Vue.js**, **Three.js**, and **Laravel 12**.

This repository contains the implemented logic behind the system's optimized interaction pipeline (OBB vs. AABB), data validation contracts (Boundary Value Analysis), and containerized cloud infrastructure.

---

## Live Demonstration (Azure Cloud)

Fully deployed to a production environment on Azure App Service via the project's CI/CD pipeline:

**Link:** [https://planner-studio.azurewebsites.net](https://planner-studio.azurewebsites.net)

Create your own account or use the test user credentials:

*   **Username:** `test@example.com`
*   **Password:** `Password12345678_!`
---

## Local Installation

This is fully supported via the included Docker environment.

### Option A: Docker

1. **Clone the repository:**
   ```bash
   git clone https://github.com/VictorHanert/3D-studio.git
   cd 3D-studio
   ```
2. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```
3. **Start the Docker environment:**
   ```bash
   docker compose up -d
   ```
4. **Install dependencies and setup the database (run inside the app container):**
   ```bash
   docker compose exec app composer install
   docker compose exec app npm ci
   docker compose exec app npm run build
   docker compose exec app php artisan key:generate
   docker compose exec app php artisan migrate
   ```
5. **Open the application:**
   Navigate to [http://localhost:8080](http://localhost:8080) in your web browser.

### Option B: Manual Installation (Laravel Herd / Valet)
Requires PHP 8.2+, Node.js, and MySQL/SQLite:

```bash
git clone https://github.com/VictorHanert/3D-studio.git
# Navigate to the project root
cd 3D-studio
composer install
npm ci
cp .env.example .env
php artisan key:generate
# Ensure your .env points to a valid database
php artisan migrate
npm run dev
```

### Running Tests

```bash
npm run test
php artisan test
```

---
*Developed by Victor Hanert for Bachelor Project, 2026.*
