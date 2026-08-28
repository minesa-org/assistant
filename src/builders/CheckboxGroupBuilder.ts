import type { JSONEncodable } from './shared.js';
import type { APICheckboxGroupComponent, APICheckboxGroupOption } from '../types/checkbox.js';
import { CHECKBOX_GROUP_COMPONENT_TYPE } from '../types/checkbox.js';
import { assertDefined, assertRange, assertStringLength, ValidationError } from '../types/validation.js';

export type CheckboxGroupBuilderData = {
  customId?: string;
  minValues?: number;
  maxValues?: number;
  required?: boolean;
  options?: APICheckboxGroupOption[];
};

/**
 * Builder for Discord's modal-only CheckboxGroup component (type 22).
 * Groups hold up to 10 options and support multiple pre-selected defaults.
 *
 * @see {@link https://discord.com/developers/docs/components/reference#checkbox-group}
 */
export class CheckboxGroupBuilder implements JSONEncodable<APICheckboxGroupComponent> {
  private readonly data: CheckboxGroupBuilderData;
  constructor(data: CheckboxGroupBuilderData = {}) { this.data = { ...data, options: data.options ? [...data.options] : [] }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }
  setMinValues(minValues: number): this { this.data.minValues = minValues; return this; }
  setMaxValues(maxValues: number): this { this.data.maxValues = maxValues; return this; }
  addOptions(...options: APICheckboxGroupOption[]): this { this.data.options = [...(this.data.options ?? []), ...options]; return this; }

  toJSON(): APICheckboxGroupComponent {
    const customId = assertDefined('CheckboxGroupBuilder', 'custom_id', this.data.customId);
    assertStringLength('CheckboxGroupBuilder', 'custom_id', customId, 1, 100);

    if (this.data.minValues !== undefined) assertRange('CheckboxGroupBuilder', 'min_values', this.data.minValues, 0, 10);
    if (this.data.maxValues !== undefined) assertRange('CheckboxGroupBuilder', 'max_values', this.data.maxValues, 1, 10);
    if (
      this.data.minValues !== undefined &&
      this.data.maxValues !== undefined &&
      this.data.minValues > this.data.maxValues
    ) {
      throw new ValidationError('CheckboxGroupBuilder', 'min_values', 'cannot be greater than max_values');
    }

    const options = [...(this.data.options ?? [])];
    if (options.length < 2 || options.length > 10) {
      throw new ValidationError('CheckboxGroupBuilder', 'options', 'must contain between 2 and 10 options');
    }

    for (const [index, option] of options.entries()) {
      assertStringLength('CheckboxGroupBuilder', `options[${index}].label`, option.label, 1, 100);
      assertStringLength('CheckboxGroupBuilder', `options[${index}].value`, option.value, 1, 100);
      if (option.description) assertStringLength('CheckboxGroupBuilder', `options[${index}].description`, option.description, 1, 100);
    }

    return {
      type: CHECKBOX_GROUP_COMPONENT_TYPE,
      custom_id: customId,
      min_values: this.data.minValues,
      max_values: this.data.maxValues,
      required: this.data.required,
      options,
    };
  }
}
