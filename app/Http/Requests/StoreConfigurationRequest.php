<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreConfigurationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'configuration_data' => ['required', 'array'],
            'configuration_data.models' => ['required', 'array', 'list'],
            'configuration_data.models.*.module_key' => ['required', 'string'],
            'configuration_data.models.*.path' => ['required', 'string'],
            'configuration_data.models.*.position' => ['required', 'array'],
            'configuration_data.models.*.position.x' => ['required', 'numeric'],
            'configuration_data.models.*.position.y' => ['required', 'numeric'],
            'configuration_data.models.*.position.z' => ['required', 'numeric'],
            'configuration_data.models.*.rotation' => ['required', 'array'],
            'configuration_data.models.*.rotation.x' => ['required', 'numeric'],
            'configuration_data.models.*.rotation.y' => ['required', 'numeric'],
            'configuration_data.models.*.rotation.z' => ['required', 'numeric'],
            'configuration_data.models.*.scale' => ['required', 'array'],
            'configuration_data.models.*.scale.x' => ['required', 'numeric', 'gt:0', 'max:100'],
            'configuration_data.models.*.scale.y' => ['required', 'numeric', 'gt:0', 'max:100'],
            'configuration_data.models.*.scale.z' => ['required', 'numeric', 'gt:0', 'max:100'],
            'configuration_data.timestamp' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
