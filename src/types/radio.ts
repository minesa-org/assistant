import {
	ComponentType,
	type APIRadioGroupComponent,
	type APIRadioGroupOption,
} from 'discord-api-types/v10';

/**
 * Radio groups are modal-only components (must be placed inside a Label).
 * Serialised as Discord's official RadioGroup component (type 21).
 *
 * @see {@link https://discord.com/developers/docs/components/reference#radio-group}
 */
export const RADIO_COMPONENT_TYPE = ComponentType.RadioGroup;

/** Alias matching Discord's own naming for the component type. */
export const RADIO_GROUP_COMPONENT_TYPE = ComponentType.RadioGroup;

export type APIRadioComponent = APIRadioGroupComponent;

export type APIRadioOption = APIRadioGroupOption;
