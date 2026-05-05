/**
 * Manages configuration persistence to localStorage and backend
 * Handles auto-save with debouncing and backend saves
 */
export class PersistenceManager {
    private readonly STORAGE_KEY = 'planner_config';
    private debounceTimer: number | null = null;

    // Autosave configuration to localStorage with debouncing on changes
    public autoSave(config: any): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Save after 1 second of no changes
        this.debounceTimer = setTimeout(() => {
            this.saveToLocalStorage(config);
        }, 1000);
    }

    private saveToLocalStorage(config: any): void {
        try {
            const serialized = JSON.stringify({
                models: config,
                timestamp: Date.now(),
            });
            localStorage.setItem(this.STORAGE_KEY, serialized);
            console.log('Configuration auto-saved to browser storage');
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    public loadFromLocalStorage(): any | null {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.models && parsed.models.length > 0) {
                    const timeStr = new Date(parsed.timestamp).toLocaleTimeString();
                    console.log(`Loaded ${parsed.models.length} models from browser storage (saved ${timeStr})`);
                    return parsed.models;
                }
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
        return null;
    }

    public async saveToBackend(config: any, configName: string = 'My Configuration'): Promise<boolean> {
        try {
            const csrfToken = this.getCsrfToken();
            if (!csrfToken) {
                console.error('CSRF token not found in page');
                return false;
            }

            const configurationData = Array.isArray(config) ? { models: config } : config;

            const response = await fetch('/api/configurations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    name: configName,
                    configuration_data: configurationData,
                }),
            });

            if (response.ok) {
                console.log('Configuration saved to database');
                return true;
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Backend save failed: ${response.status} ${response.statusText}`, errorData);
                return false;
            }
        } catch (error) {
            console.error('Failed to save to backend:', error);
            return false;
        }
    }

    public clearLocalStorage(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('Configuration cleared');
    }

    public hasLocalStorage(): boolean {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    }

    public async loadFromBackendByCode(code: string): Promise<any | null> {
        try {
            const response = await fetch(`/api/configurations/share/${code}`);
            if (response.ok) {
                const data = await response.json();
                return data.configuration?.configuration_data?.models || null;
            }
            console.error('Failed to load configuration:', response.statusText);
            return null;
        } catch (error) {
            console.error('Failed to load from backend:', error);
            return null;
        }
    }

    public async getUserConfigurations(): Promise<any[]> {
        try {
            const response = await fetch('/api/configurations');
            if (response.ok) {
                const data = await response.json();
                return data.configurations || [];
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch configurations:', error);
            return [];
        }
    }

    private getCsrfToken(): string {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        return token || '';
    }
}
