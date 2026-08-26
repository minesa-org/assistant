import type { JSONEncodable } from './shared.js';
import type { APIRadioComponent, APIRadioOption } from '../types/radio.js';
import { RADIO_COMPONENT_TYPE } from '../types/radio.js';
import { assertDefined, assertStringLength, ValidationError } from '../types/validation.js';

export type RadioBuilderData = { customId?: string; required?: boolean; options?: APIRadioOption[] };

/**
 * Builder for Discord's modal-only RadioGroup component (type 21).
 * Groups hold between 2 and 10 options with at most one pre-selected default,
 * and must be placed inside a Label in a modal.
 *
 * @see {@link https://discord.com/developers/docs/components/reference#radio-group}
 */
export class RadioBuilder implements JSONEncodable<APIRadioComponent> {
  private readonly data: RadioBuilderData;
  constructor(data: RadioBuilderData = {}) { this.data = { ...data, options: data.options ? [...data.options] : [] }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }
  addOptions(...options: APIRadioOption[]): this { this.data.options = [...(this.data.options ?? []), ...options]; return this; }

  toJSON(): APIRadioComponent {
    const customId = assertDefined('RadioBuilder', 'custom_id', this.data.customId);
    assertStringLength('RadioBuilder', 'custom_id', customId, 1, 100);

    const options = [...(this.data.options ?? [])];
    if (options.length < 2 || options.length > 10) {
      throw new ValidationError('RadioBuilder', 'options', 'must contain between 2 and 10 options');
    }

    let defaults = 0;
    for (const [index, option] of options.entries()) {
      assertStringLength('RadioBuilder', `options[${index}].label`, option.label, 1, 100);
      assertStringLength('RadioBuilder', `options[${index}].value`, option.value, 1, 100);
      if (option.description) assertStringLength('RadioBuilder', `options[${index}].description`, option.description, 1, 100);
      if (option.default) defaults += 1;
    }
    if (defaults > 1) throw new ValidationError('RadioBuilder', 'options.default', 'radio supports only one default option');

    return { type: RADIO_COMPONENT_TYPE, custom_id: customId, required: this.data.required, options };
  }
}
