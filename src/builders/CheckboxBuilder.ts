import type { JSONEncodable } from './shared.js';
import { APICheckboxComponent, CHECKBOX_COMPONENT_TYPE } from '../types/checkbox.js';
import { assertDefined, assertStringLength } from '../types/validation.js';

export type CheckboxBuilderData = { customId?: string; default?: boolean };

/**
 * Builder for Discord's modal-only single Checkbox component (type 23).
 * A single checkbox holds no options; use {@link CheckboxGroupBuilder} for
 * multi-option checkbox groups.
 *
 * @see {@link https://discord.com/developers/docs/components/reference#checkbox}
 */
export class CheckboxBuilder implements JSONEncodable<APICheckboxComponent> {
  private readonly data: CheckboxBuilderData;
  constructor(data: CheckboxBuilderData = {}) { this.data = { ...data }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setDefault(isDefault: boolean): this { this.data.default = isDefault; return this; }

  toJSON(): APICheckboxComponent {
    const customId = assertDefined('CheckboxBuilder', 'custom_id', this.data.customId);
    assertStringLength('CheckboxBuilder', 'custom_id', customId, 1, 100);

    return { type: CHECKBOX_COMPONENT_TYPE, custom_id: customId, default: this.data.default };
  }
}
