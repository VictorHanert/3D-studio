<script setup lang="js">
import { Link, usePage, router } from '@inertiajs/vue3';
import { Lineicons } from "@lineiconshq/vue-lineicons";
import { Home2Outlined, Locked1Outlined, User4Outlined, ExitOutlined, AirtableOutlined } from "@lineiconshq/free-icons";
import AppLogoIcon from '@/components/app/AppLogoIcon.vue';
import Toast from '@/components/ui/Toast.vue';
import { home, editor, login, register, logout } from '@/routes';

const page = usePage();
const user = page.props.auth?.user;

const currentUrl = page.url;

const isActive = (url) => currentUrl === url;

const handleLogout = () => {
    router.post(logout().url, {}, {
        onSuccess: () => {
            // Force a visit to home page to ensure auth state is properly updated
            router.visit('/', {
                method: 'get',
                replace: true,
                preserveState: false,
                preserveScroll: false
            });
        },
        onError: () => {
            // Handle logout error if needed
        }
    });
};
</script>

<template>
    <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <!-- Navbar -->
        <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div class="max-w mx-auto px-6 sm:px-8 lg:px-12">
                <div class="flex justify-between items-center h-16">
                    <!-- Logo -->
                    <Link :href="home()" class="flex items-center cursor-pointer">
                        <AppLogoIcon size="xl" class="h-8 w-auto text-gray-900 dark:text-white" />
                    </Link>

                    <!-- Navigation Links -->
                    <div class="flex items-center space-x-4">
                        <template v-if="user">
                            <Link
                                :href="home()"
                                :class="[
                                    'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                                    isActive('/') 
                                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' 
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                ]"
                            >
                                <Lineicons :icon="Home2Outlined" :size="24" :stroke-width="2" />
                                Home
                            </Link>
                            <Link
                                :href="editor()"
                                :class="[
                                    'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                                    isActive('/editor') 
                                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' 
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                ]"
                            >
                                <Lineicons :icon="AirtableOutlined" :size="24" :stroke-width="2" />
                                Editor
                            </Link>
                            <button
                                @click="handleLogout"
                                class="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-600 cursor-pointer"
                            >
                                <Lineicons :icon="ExitOutlined" :size="24" :stroke-width="2" />
                                Logout
                            </button>
                        </template>
                        <template v-else>
                            <Link
                                :href="login()"
                                :class="[
                                    'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                                    isActive('/login') 
                                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' 
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                ]"
                            >
                                <Lineicons :icon="Locked1Outlined" :size="24" :stroke-width="2" />
                                Login
                            </Link>
                            <Link
                                :href="register()"
                                :class="[
                                    'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200',
                                    isActive('/register') 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                ]"
                            >
                                <Lineicons :icon="User4Outlined" :size="24" :stroke-width="2" />
                                Register
                            </Link>
                        </template>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="flex-1 overflow-hidden">
            <slot />
        </main>

        <!-- Toast Notifications -->
        <Toast />

        <!-- Footer -->
        <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <p class="text-center text-sm text-gray-500 dark:text-gray-400">
                    © {{ new Date().getFullYear() }} The Planner Studio. All rights reserved.
                </p>
            </div>
        </footer>
    </div>
</template>
