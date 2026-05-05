<?php

use App\Models\User;
use Illuminate\Testing\Fluent\AssertableJson;

it('stores and lists configurations with expected json shape', function () {
    $user = User::factory()->create();

    $payload = [
        'name' => 'Living Room Plan',
        'configuration_data' => [
            'models' => [
                [
                    'module_key' => 'CONNECT_MODULAR_SOFA_LEFT_ARMREST_A',
                    'path' => 'models/sofa.glb',
                    'position' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
                    'scale' => ['x' => 1, 'y' => 1, 'z' => 1],
                ],
            ],
            'timestamp' => '2026-04-30T12:00:00Z',
        ],
    ];

    $storeResponse = $this->actingAs($user)
        ->postJson('/api/configurations', $payload);

    $storeResponse
        ->assertCreated()
        ->assertJson(fn (AssertableJson $json) => $json->where('success', true)
            ->where('message', 'Configuration saved successfully')
            ->has('configuration')
            ->etc()
        )
        ->assertJsonStructure([
            'success',
            'message',
            'configuration' => [
                'id',
                'user_id',
                'name',
                'configuration_data',
                'share_code',
                'created_at',
                'updated_at',
            ],
        ]);

    $listResponse = $this->actingAs($user)->getJson('/api/configurations');

    $listResponse
        ->assertOk()
        ->assertJson(fn (AssertableJson $json) => $json->where('success', true)
            ->has('configurations')
            ->etc()
        )
        ->assertJsonStructure([
            'success',
            'configurations' => [
                '*' => [
                    'id',
                    'user_id',
                    'name',
                    'configuration_data',
                    'share_code',
                    'created_at',
                    'updated_at',
                ],
            ],
        ]);
});
