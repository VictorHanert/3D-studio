import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import type { ModelData, Position2D } from '@/system/utilities/types';
import { InteractionManager } from '@/system/managers/InteractionManager';

type CanvasListener = (event: { clientX: number; clientY: number }) => void;

class CanvasMock {
    public readonly style = { cursor: 'default' };
    public readonly clientWidth = 800;
    public readonly clientHeight = 600;
    private readonly listeners = new Map<string, CanvasListener[]>();

    addEventListener(type: string, listener: CanvasListener): void {
        const current = this.listeners.get(type) ?? [];
        current.push(listener);
        this.listeners.set(type, current);
    }

    removeEventListener(type: string, listener: CanvasListener): void {
        const current = this.listeners.get(type) ?? [];
        this.listeners.set(type, current.filter((registered) => registered !== listener));
    }

    getBoundingClientRect(): DOMRect {
        return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: this.clientWidth,
            bottom: this.clientHeight,
            width: this.clientWidth,
            height: this.clientHeight,
            toJSON: () => ({}),
        } as DOMRect;
    }

    dispatchPointerEvent(type: string, event: { clientX: number; clientY: number }): void {
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
    }
}

function createModel(id: string, position: THREE.Vector3): ModelData {
    const object = new THREE.Group();
    object.position.copy(position);
    object.quaternion.identity();
    object.scale.set(1, 1, 1);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    object.add(mesh);

    const bounds = {
        box: new THREE.Box3(
            new THREE.Vector3(-1, 0, -1),
            new THREE.Vector3(1, 2, 1)
        ),
        size: new THREE.Vector3(2, 2, 2),
    };

    return {
        id,
        modelKey: id,
        object,
        bounds,
        cachedBounds: bounds.box.clone(),
        path: `/models/${id}.glb`,
        meshes: [mesh],
    } as ModelData;
}

describe('InteractionManager drag constraints', () => {
    const controls = { enabled: true } as unknown as OrbitControls;
    const hoveredModel = ref<ModelData | null>(null) as Ref<ModelData | null>;
    const showControls = ref(false);
    const controlPosition = ref<Position2D>({ x: 0, y: 0 });
    let canvas: CanvasMock;
    let renderer: THREE.WebGLRenderer;
    let camera: THREE.PerspectiveCamera;

    beforeEach(() => {
        canvas = new CanvasMock();
        renderer = { domElement: canvas } as unknown as THREE.WebGLRenderer;
        camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        controls.enabled = true;
        hoveredModel.value = null;
        showControls.value = false;
        controlPosition.value = { x: 0, y: 0 };

        vi.spyOn(THREE.Raycaster.prototype, 'setFromCamera').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('clamps dragged models to the ground extents', () => {
        const model = createModel('selected', new THREE.Vector3(0, 0, 0));
        const models = ref<ModelData[]>([model]);
        const manager = new InteractionManager(
            camera,
            renderer,
            controls,
            models,
            model.meshes,
            hoveredModel,
            showControls,
            controlPosition,
            null,
            5
        );

        let currentIntersection = new THREE.Vector3(0, 0, 0);
        vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValueOnce([
            { object: model.meshes[0] } as THREE.Intersection<THREE.Object3D>
        ]);
        vi.spyOn(THREE.Ray.prototype, 'intersectPlane').mockImplementation((_, target) => {
            target.copy(currentIntersection);
            return target;
        });

        manager.setupInteractions();

        canvas.dispatchPointerEvent('pointerdown', { clientX: 400, clientY: 300 });

        currentIntersection = new THREE.Vector3(20, 0, -20);
        canvas.dispatchPointerEvent('pointermove', { clientX: 700, clientY: 100 });

        expect(model.object.position.x).toBeCloseTo(4);
        expect(model.object.position.z).toBeCloseTo(-4);
        expect(model.object.position.y).toBeCloseTo(0);
    });

    it('rejects a drag that would collide with another model', () => {
        const dragged = createModel('dragged', new THREE.Vector3(-2, 0, 0));
        const blocker = createModel('blocker', new THREE.Vector3(0, 0, 0));
        const models = ref<ModelData[]>([dragged, blocker]);
        const manager = new InteractionManager(
            camera,
            renderer,
            controls,
            models,
            dragged.meshes,
            hoveredModel,
            showControls,
            controlPosition,
            null,
            5
        );

        let currentIntersection = dragged.object.position.clone();
        vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValueOnce([
            { object: dragged.meshes[0] } as THREE.Intersection<THREE.Object3D>
        ]);
        vi.spyOn(THREE.Ray.prototype, 'intersectPlane').mockImplementation((_, target) => {
            target.copy(currentIntersection);
            return target;
        });

        manager.setupInteractions();

        canvas.dispatchPointerEvent('pointerdown', { clientX: 400, clientY: 300 });

        currentIntersection = new THREE.Vector3(0, 0, 0);
        canvas.dispatchPointerEvent('pointermove', { clientX: 400, clientY: 300 });

        expect(dragged.object.position.x).toBeCloseTo(-2);
        expect(dragged.object.position.z).toBeCloseTo(0);
    });

    it('resets hover state after a raycast miss timeout', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);

        const model = createModel('hovered', new THREE.Vector3(0, 0, 0));
        const models = ref<ModelData[]>([model]);
        showControls.value = true;

        const manager = new InteractionManager(
            camera,
            renderer,
            controls,
            models,
            model.meshes,
            hoveredModel,
            showControls,
            controlPosition,
            null,
            5
        );

        vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([]);

        manager.setupInteractions();

        canvas.dispatchPointerEvent('pointermove', { clientX: 10, clientY: 10 });

        expect(canvas.style.cursor).toBe('default');
        expect(showControls.value).toBe(true);
        expect(hoveredModel.value).toBeNull();

        vi.advanceTimersByTime(500);

        expect(showControls.value).toBe(false);
        expect(hoveredModel.value).toBeNull();
    });

    it('cancels dragging on pointerleave and prevents additional movement', () => {
        const model = createModel('selected', new THREE.Vector3(0, 0, 0));
        const models = ref<ModelData[]>([model]);
        const manager = new InteractionManager(
            camera,
            renderer,
            controls,
            models,
            model.meshes,
            hoveredModel,
            showControls,
            controlPosition,
            null,
            5
        );

        let currentIntersection = new THREE.Vector3(0, 0, 0);
        vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects')
            .mockReturnValueOnce([{ object: model.meshes[0] } as THREE.Intersection<THREE.Object3D>])
            .mockReturnValue([]);
        vi.spyOn(THREE.Ray.prototype, 'intersectPlane').mockImplementation((_, target) => {
            target.copy(currentIntersection);
            return target;
        });

        manager.setupInteractions();

        canvas.dispatchPointerEvent('pointerdown', { clientX: 400, clientY: 300 });

        currentIntersection = new THREE.Vector3(3, 0, 0);
        canvas.dispatchPointerEvent('pointermove', { clientX: 450, clientY: 300 });
        expect(model.object.position.x).toBeCloseTo(3);

        canvas.dispatchPointerEvent('pointerleave', { clientX: 450, clientY: 300 });

        currentIntersection = new THREE.Vector3(4, 0, 0);
        canvas.dispatchPointerEvent('pointermove', { clientX: 500, clientY: 300 });

        expect(model.object.position.x).toBeCloseTo(3);
        expect(controls.enabled).toBe(true);
        expect(canvas.style.cursor).toBe('default');
    });
});