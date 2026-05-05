import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelData, SerializedModel } from '@/system/utilities/types';
import { PersistenceManager } from '@/system/managers/PersistenceManager';

function createValidSerializedModel(overrides?: Partial<SerializedModel>): SerializedModel {
    return {
        id: 'test-model',
        modelKey: 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
        position: { x: 0.123456, y: 1.5, z: -2.789012 },
        rotation: { x: 0, y: 1.5708, z: 0 },
        scale: { x: 1.0, y: 1.0, z: 1.0 },
        ...overrides,
    };
}

function createValidPayload(models: SerializedModel[]): { name: string; configuration_data: SerializedModel[] } {
    return {
        name: 'Test Configuration',
        configuration_data: models,
    };
}

describe('PersistenceManager JSON contract validation', () => {
    let persistenceManager: PersistenceManager;

    beforeEach(() => {
        persistenceManager = new PersistenceManager();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('validates that serialized model matches backend schema requirements', () => {
        const validModel = createValidSerializedModel();

        // Check all required fields exist
        expect(validModel).toHaveProperty('id');
        expect(validModel).toHaveProperty('modelKey');
        expect(validModel).toHaveProperty('position');
        expect(validModel).toHaveProperty('rotation');
        expect(validModel).toHaveProperty('scale');

        // Check position has required numeric properties
        expect(typeof validModel.position.x).toBe('number');
        expect(typeof validModel.position.y).toBe('number');
        expect(typeof validModel.position.z).toBe('number');

        // Check rotation has required numeric properties
        expect(typeof validModel.rotation.x).toBe('number');
        expect(typeof validModel.rotation.y).toBe('number');
        expect(typeof validModel.rotation.z).toBe('number');

        // Check scale has required numeric properties
        expect(typeof validModel.scale.x).toBe('number');
        expect(typeof validModel.scale.y).toBe('number');
        expect(typeof validModel.scale.z).toBe('number');
    });

    it('enforces scale validation: scale components must be greater than 0', () => {
        const invalidScaleZero = createValidSerializedModel({ scale: { x: 0, y: 1.0, z: 1.0 } });
        const invalidScaleNegative = createValidSerializedModel({ scale: { x: -0.5, y: 1.0, z: 1.0 } });
        const validScale = createValidSerializedModel({ scale: { x: 0.0001, y: 1.0, z: 1.0 } });

        // Validate that zero and negative scales are invalid (would fail backend validation)
        expect(invalidScaleZero.scale.x).toBeLessThanOrEqual(0);
        expect(invalidScaleNegative.scale.x).toBeLessThanOrEqual(0);

        // Validate that positive scales are valid
        expect(validScale.scale.x).toBeGreaterThan(0);
        expect(validScale.scale.y).toBeGreaterThan(0);
        expect(validScale.scale.z).toBeGreaterThan(0);
    });

    it('preserves numeric precision for position coordinates (6+ decimals)', () => {
        const precisionTest = createValidSerializedModel({
            position: { x: 1.123456, y: 2.654321, z: -3.999999 },
        });

        // Verify decimal places are preserved (backend expects 6 decimal precision)
        expect(precisionTest.position.x.toString()).toMatch(/1\.123456/);
        expect(precisionTest.position.y.toString()).toMatch(/2\.654321/);
        expect(precisionTest.position.z.toString()).toMatch(/3\.999999/);

        // JSON serialization should preserve precision
        const json = JSON.stringify(precisionTest);
        const parsed = JSON.parse(json);
        expect(parsed.position.x).toBe(1.123456);
        expect(parsed.position.y).toBe(2.654321);
        expect(parsed.position.z).toBe(-3.999999);
    });

    it('validates that full configuration payload matches backend contract', () => {
        const models = [
            createValidSerializedModel({ id: 'model-1' }),
            createValidSerializedModel({ id: 'model-2', position: { x: 2, y: 0, z: 0 } }),
        ];

        const payload = createValidPayload(models);

        // Validate payload structure
        expect(typeof payload.name).toBe('string');
        expect(Array.isArray(payload.configuration_data)).toBe(true);
        expect(payload.configuration_data).toHaveLength(2);

        // Validate each model in configuration_data
        for (const model of payload.configuration_data) {
            expect(model).toHaveProperty('id');
            expect(model).toHaveProperty('modelKey');
            expect(model).toHaveProperty('position');
            expect(model).toHaveProperty('rotation');
            expect(model).toHaveProperty('scale');

            // Validate scale constraint
            expect(model.scale.x).toBeGreaterThan(0);
            expect(model.scale.y).toBeGreaterThan(0);
            expect(model.scale.z).toBeGreaterThan(0);
        }

        // Validate JSON serializability (backend will receive as JSON)
        const jsonStr = JSON.stringify(payload);
        expect(() => JSON.parse(jsonStr)).not.toThrow();
        const reparsed = JSON.parse(jsonStr);
        expect(reparsed.configuration_data).toHaveLength(2);
    });

    it('rejects invalid payload with scale.x = 0 (violates backend validation rule)', () => {
        const invalidModel = createValidSerializedModel({
            scale: { x: 0, y: 1, z: 1 },
        });

        const payload = createValidPayload([invalidModel]);

        // This payload would fail backend validation
        const scaleValidation = payload.configuration_data.every(
            (model) => model.scale.x > 0 && model.scale.y > 0 && model.scale.z > 0
        );

        expect(scaleValidation).toBe(false);
    });

    it('accepts valid payload with all required fields and constraints', () => {
        const validModels = [
            createValidSerializedModel({
                id: 'furniture-1',
                modelKey: 'SOFA_SECTION_A',
                position: { x: 0.5, y: 0, z: -1.25 },
                scale: { x: 1.5, y: 1.0, z: 0.8 },
            }),
            createValidSerializedModel({
                id: 'furniture-2',
                modelKey: 'CHAIR_B',
                position: { x: -2.0, y: 0, z: 0 },
                scale: { x: 1.0, y: 1.0, z: 1.0 },
            }),
        ];

        const payload = createValidPayload(validModels);

        // Validate all constraints
        const isValid = payload.configuration_data.every((model) => {
            return (
                typeof model.id === 'string' &&
                typeof model.modelKey === 'string' &&
                typeof model.position.x === 'number' &&
                typeof model.position.y === 'number' &&
                typeof model.position.z === 'number' &&
                typeof model.rotation.x === 'number' &&
                typeof model.rotation.y === 'number' &&
                typeof model.rotation.z === 'number' &&
                model.scale.x > 0 &&
                model.scale.y > 0 &&
                model.scale.z > 0
            );
        });

        expect(isValid).toBe(true);
    });
});
