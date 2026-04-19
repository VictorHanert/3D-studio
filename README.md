# Planner Studio

A 3D furniture planning and design application built with Laravel and Vue.js.

## Features

- **3D Furniture Planning**: Design and visualize modular furniture layouts
- **Modular Components**: Configure and arrange furniture modules
- **User Authentication**: Secure user accounts with Laravel Fortify
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode Support**: Toggle between light and dark themes

## Tech Stack

- **Backend**: Laravel 12, PHP 8.2+
- **Frontend**: Vue 3, TypeScript, Inertia.js
- **Styling**: Tailwind CSS 4
- **Database**: SQLite (configurable)
- **Authentication**: Laravel Fortify

## Getting Started

1. Clone the repository
2. Install PHP dependencies: `composer install`
3. Install Node dependencies: `npm install`
4. Copy environment file: `cp .env.example .env`
5. Generate application key: `php artisan key:generate`
6. Run database migrations: `php artisan migrate`
7. Build assets: `npm run build`
8. Start the development server: `php artisan serve`

## Development

- Start the frontend dev server: `npm run dev`
- Format code: `npm run format`
- Lint code: `npm run lint`

## License

MIT