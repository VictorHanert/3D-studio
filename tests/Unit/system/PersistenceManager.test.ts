import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistenceManager } from '@/system/managers/PersistenceManager';
import type { SerializedModel } from '@/system/utilities/types';

function createValidSerializedModel(overrides?: Partial<SerializedModel>): SerializedModel {
    return {
        module_key: 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
        path: '/models/connect-modular-sofa-left-armrest-a.glb',
        position: { x: 0.123456, y: 1.5, z: -2.789012 },
        rotation: { x: 0, y: 1.5708, z: 0 },
        scale: { x: 1.0, y: 1.0, z: 1.0 },
        ...overrides,
    };
}

describe('PersistenceManager', () => {
    let manager: PersistenceManager;
    let mockLocalStorage: Record<string, string>;

    beforeEach(() => {
        manager = new PersistenceManager();
        mockLocalStorage = {};

        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
            setItem: vi.fn((key: string, value: string) => {
                mockLocalStorage[key] = value;
            }),
            removeItem: vi.fn((key: string) => {
                delete mockLocalStorage[key];
            }),
        });

        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    // ─── autoSave + localStorage ───────────────────────────────────────

    it('persists configuration to localStorage after autoSave debounce completes', () => {
        vi.useFakeTimers();

        const models = [createValidSerializedModel()];
        manager.autoSave(models);

        // Before debounce fires, nothing is stored
        expect(localStorage.setItem).not.toHaveBeenCalled();

        // After 1 second debounce
        vi.advanceTimersByTime(1000);

        expect(localStorage.setItem).toHaveBeenCalledTimes(1);
        const [key, serialized] = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(key).toBe('planner_config');

        const parsed = JSON.parse(serialized);
        expect(parsed.models).toHaveLength(1);
        expect(parsed.models[0].module_key).toBe('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A');
        expect(parsed.timestamp).toBeTypeOf('number');
    });

    it('debounces multiple rapid autoSave calls into a single write', () => {
        vi.useFakeTimers();

        manager.autoSave([createValidSerializedModel({ module_key: 'FIRST' })]);
        vi.advanceTimersByTime(500);
        manager.autoSave([createValidSerializedModel({ module_key: 'SECOND' })]);
        vi.advanceTimersByTime(500);
        manager.autoSave([createValidSerializedModel({ module_key: 'THIRD' })]);
        vi.advanceTimersByTime(1000);

        // Only the last call should have been persisted
        expect(localStorage.setItem).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse((localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1]);
        expect(parsed.models[0].module_key).toBe('THIRD');
    });

    // ─── loadFromLocalStorage ──────────────────────────────────────────

    it('loads and returns saved models from localStorage', () => {
        const savedModels = [createValidSerializedModel()];
        mockLocalStorage['planner_config'] = JSON.stringify({
            models: savedModels,
            timestamp: Date.now(),
        });

        const loaded = manager.loadFromLocalStorage();

        expect(loaded).toHaveLength(1);
        expect(loaded[0].module_key).toBe('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A');
        expect(loaded[0].position.x).toBe(0.123456);
    });

    it('returns null when localStorage is empty', () => {
        expect(manager.loadFromLocalStorage()).toBeNull();
    });

    it('returns null when localStorage contains invalid JSON', () => {
        mockLocalStorage['planner_config'] = '{broken json';
        expect(manager.loadFromLocalStorage()).toBeNull();
    });

    it('returns null when stored configuration has an empty models array', () => {
        mockLocalStorage['planner_config'] = JSON.stringify({
            models: [],
            timestamp: Date.now(),
        });

        expect(manager.loadFromLocalStorage()).toBeNull();
    });

    // ─── clearLocalStorage ─────────────────────────────────────────────

    it('removes the planner_config key from localStorage', () => {
        mockLocalStorage['planner_config'] = 'something';

        manager.clearLocalStorage();

        expect(localStorage.removeItem).toHaveBeenCalledWith('planner_config');
    });

    // ─── saveToBackend ─────────────────────────────────────────────────

    it('sends correct payload to /api/configurations and returns true on success', async () => {
        // Mock document.querySelector for CSRF token lookup
        vi.stubGlobal('document', {
            querySelector: vi.fn(() => ({ getAttribute: () => 'test-csrf-token' })),
        });

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        } as Response);

        const models = [createValidSerializedModel()];
        const result = await manager.saveToBackend(models, 'My Sofa');

        expect(result).toBe(true);
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toBe('/api/configurations');
        expect(options.method).toBe('POST');
        expect(options.headers['X-CSRF-TOKEN']).toBe('test-csrf-token');

        const body = JSON.parse(options.body);
        expect(body.name).toBe('My Sofa');
        expect(body.configuration_data.models).toHaveLength(1);
        expect(body.configuration_data.models[0].module_key).toBe('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A');
    });

    it('returns false when the backend responds with an error status', async () => {
        vi.stubGlobal('document', {
            querySelector: vi.fn(() => ({ getAttribute: () => 'test-csrf-token' })),
        });

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 422,
            statusText: 'Unprocessable Entity',
            json: async () => ({ errors: {} }),
        } as unknown as Response);

        const result = await manager.saveToBackend([createValidSerializedModel()]);
        expect(result).toBe(false);
    });

    it('returns false when no CSRF token is found', async () => {
        vi.stubGlobal('document', {
            querySelector: vi.fn(() => null),
        });

        const result = await manager.saveToBackend([createValidSerializedModel()]);
        expect(result).toBe(false);
    });

    // ─── loadFromBackendByCode ─────────────────────────────────────────

    it('returns models array from backend when share code is valid', async () => {
        const expectedModels = [createValidSerializedModel()];

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                configuration: {
                    configuration_data: {
                        models: expectedModels,
                    },
                },
            }),
        } as Response);

        const result = await manager.loadFromBackendByCode('ABC12345');

        expect(result).toHaveLength(1);
        expect(result[0].module_key).toBe('CONNECT_MODULAR_SOFA_LEFT_ARMREST_A');
    });

    it('returns null when share code is not found (404)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            statusText: 'Not Found',
        } as Response);

        const result = await manager.loadFromBackendByCode('INVALID');
        expect(result).toBeNull();
    });

    // ─── getUserConfigurations ──────────────────────────────────────────

    it('returns an array of user configurations from the backend', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                configurations: [
                    { id: 1, name: 'Config A' },
                    { id: 2, name: 'Config B' },
                ],
            }),
        } as Response);

        const configs = await manager.getUserConfigurations();
        expect(configs).toHaveLength(2);
        expect(configs[0].name).toBe('Config A');
    });

    it('returns an empty array when fetch fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

        const configs = await manager.getUserConfigurations();
        expect(configs).toEqual([]);
    });
});
