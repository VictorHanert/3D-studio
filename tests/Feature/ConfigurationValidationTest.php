<?php

use App\Models\User;

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
