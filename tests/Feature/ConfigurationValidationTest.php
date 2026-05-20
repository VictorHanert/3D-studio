<?php

use App\Models\User;

it('persists a valid configuration to the database (happy path)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Living Room Setup',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 1.5, 'y' => 0, 'z' => -2.3],
                    'rotation' => ['x' => 0, 'y' => 1.5708, 'z' => 0],
                    'scale' => ['x' => 1, 'y' => 1, 'z' => 1],
                ],
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_MIDDLE_A',
                    'path' => 'models/middle.glb',
                    'position' => ['x' => 2.8, 'y' => 0, 'z' => -2.3],
                    'rotation' => ['x' => 0, 'y' => 1.5708, 'z' => 0],
                    'scale' => ['x' => 1.5, 'y' => 1.5, 'z' => 1.5],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertStatus(201)
        ->assertJson([
            'success' => true,
            'message' => 'Configuration saved successfully',
        ]);

    $this->assertDatabaseHas('user_configurations', [
        'user_id' => $user->id,
        'name' => 'Living Room Setup',
        'configuration_data' => json_encode($payload['configuration_data']),
    ]);
});

it('rejects a configuration with a non-numeric position value', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Broken Plan',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 'not-a-number', 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 1, 'y' => 1, 'z' => 1],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['configuration_data.models.0.position.x']);
});

it('rejects a configuration when module_key is missing', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Broken Plan',
        'configuration_data' => [
            'models' => [
                [
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 1, 'y' => 1, 'z' => 1],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['configuration_data.models.0.module_key']);
});

it('rejects a configuration with zero scale (BVA boundary)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Zero Scale Plan',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 0, 'y' => 1, 'z' => 1],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['configuration_data.models.0.scale.x']);
});

it('rejects a configuration with negative scale (BVA: -0.01)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Negative Scale Plan',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => -0.01, 'y' => 1, 'z' => 1],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['configuration_data.models.0.scale.x']);
});

it('accepts a configuration with minimal positive scale (BVA: 0.01)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Minimal Scale Plan',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 0.01, 'y' => 0.01, 'z' => 0.01],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertCreated();
});

it('accepts a configuration with scale just above boundary (BVA: 0.02)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Above Boundary Scale Plan',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 0.02, 'y' => 0.02, 'z' => 0.02],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertCreated();
});

it('accepts a configuration with scale just below upper boundary (BVA: 99.99)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Below Upper Boundary Scale',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 99.99, 'y' => 99.99, 'z' => 99.99],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertCreated();
});

it('accepts a configuration with scale at exact upper boundary (BVA: 100.00)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Exact Upper Boundary Scale',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 100.00, 'y' => 100.00, 'z' => 100.00],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertCreated();
});

it('rejects a configuration with scale exceeding upper boundary (BVA: 100.01)', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Above Upper Boundary Scale',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 100.01, 'y' => 1, 'z' => 1],
                ],
            ],
        ],
    ];

    $this->actingAs($user)
        ->postJson('/api/configurations', $payload)
        ->assertStatus(422)
        ->assertJsonValidationErrors(['configuration_data.models.0.scale.x']);
});
