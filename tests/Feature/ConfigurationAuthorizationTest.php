<?php

use App\Models\User;

/**
 * Helper: creates a valid configuration payload for the store endpoint.
 *
 * @return array<string, mixed>
 */
function validConfigurationPayload(): array
{
    return [
        'name' => 'Test Configuration',
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
        ],
    ];
}

// ──────────────────────────────────────────────────
// Guest (unauthenticated) access
// ──────────────────────────────────────────────────

it('rejects unauthenticated users from storing a configuration', function () {
    $this->postJson('/api/configurations', validConfigurationPayload())
        ->assertUnauthorized();
});

it('rejects unauthenticated users from listing configurations', function () {
    $this->getJson('/api/configurations')
        ->assertUnauthorized();
});

it('rejects unauthenticated users from viewing a configuration', function () {
    $owner = User::factory()->create();
    $config = $owner->configurations()->create([
        'name' => 'Private Config',
        'configuration_data' => ['models' => []],
    ]);

    $this->getJson("/api/configurations/{$config->id}")
        ->assertUnauthorized();
});

it('rejects unauthenticated users from deleting a configuration', function () {
    $owner = User::factory()->create();
    $config = $owner->configurations()->create([
        'name' => 'Private Config',
        'configuration_data' => ['models' => []],
    ]);

    $this->deleteJson("/api/configurations/{$config->id}")
        ->assertUnauthorized();
});

// ──────────────────────────────────────────────────
// Cross-user authorization (policy enforcement)
// ──────────────────────────────────────────────────

it('forbids a user from viewing another users configuration', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();

    $config = $owner->configurations()->create([
        'name' => 'Owner Only',
        'configuration_data' => ['models' => []],
    ]);

    $this->actingAs($intruder)
        ->getJson("/api/configurations/{$config->id}")
        ->assertForbidden();
});

it('forbids a user from deleting another users configuration', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();

    $config = $owner->configurations()->create([
        'name' => 'Owner Only',
        'configuration_data' => ['models' => []],
    ]);

    $this->actingAs($intruder)
        ->deleteJson("/api/configurations/{$config->id}")
        ->assertForbidden();

    // Verify the configuration still exists in the database
    $this->assertDatabaseHas('user_configurations', ['id' => $config->id]);
});

// ──────────────────────────────────────────────────
// Owner access (positive cases)
// ──────────────────────────────────────────────────

it('allows the owner to view their own configuration', function () {
    $owner = User::factory()->create();

    $config = $owner->configurations()->create([
        'name' => 'My Config',
        'configuration_data' => ['models' => []],
    ]);

    $this->actingAs($owner)
        ->getJson("/api/configurations/{$config->id}")
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('configuration.id', $config->id);
});

it('allows the owner to delete their own configuration', function () {
    $owner = User::factory()->create();

    $config = $owner->configurations()->create([
        'name' => 'Deletable',
        'configuration_data' => ['models' => []],
    ]);

    $this->actingAs($owner)
        ->deleteJson("/api/configurations/{$config->id}")
        ->assertOk()
        ->assertJsonPath('success', true);

    $this->assertDatabaseMissing('user_configurations', ['id' => $config->id]);
});

// ──────────────────────────────────────────────────
// Share code (public endpoint)
// ──────────────────────────────────────────────────

it('loads a configuration by valid share code without authentication', function () {
    $owner = User::factory()->create();

    $config = $owner->configurations()->create([
        'name' => 'Shared Config',
        'configuration_data' => ['models' => []],
    ]);

    $this->getJson("/api/configurations/share/{$config->share_code}")
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('configuration.id', $config->id);
});

it('returns 404 for an invalid share code', function () {
    $this->getJson('/api/configurations/share/INVALID_CODE')
        ->assertNotFound()
        ->assertJsonPath('success', false);
});
