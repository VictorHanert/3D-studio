<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserConfiguration;

class UserConfigurationPolicy
{
    /**
     * Determine whether the user can view the configuration.
     */
    public function view(User $user, UserConfiguration $userConfiguration): bool
    {
        return $user->id === $userConfiguration->user_id;
    }

    /**
     * Determine whether the user can delete the configuration.
     */
    public function delete(User $user, UserConfiguration $userConfiguration): bool
    {
        return $user->id === $userConfiguration->user_id;
    }
}
