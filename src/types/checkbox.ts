import { ComponentType } from 'discord-api-types/v10';
import type {
	APICheckboxComponent,
	APICheckboxGroupComponent,
	APICheckboxGroupOption,
} from 'discord-api-types/v10';

/**
 * Checkboxes are modal-only components.
 * A single checkbox (type 23) holds no options; a checkbox group (type 22)
 * holds up to 10 selectable options.
 *
 * @see {@link https://discord.com/developers/docs/components/reference#checkbox}
 * @see {@link https://discord.com/developers/docs/components/reference#checkbox-group}
 */
export const CHECKBOX_COMPONENT_TYPE = ComponentType.Checkbox;

/** Type value for multi-select checkbox groups (type 22). */
export const CHECKBOX_GROUP_COMPONENT_TYPE = ComponentType.CheckboxGroup;

export type { APICheckboxComponent, APICheckboxGroupComponent, APICheckboxGroupOption };

/** Backwards-compatible alias: the options-array model belongs to checkbox groups. */
export type APICheckboxOption = APICheckboxGroupOption;
