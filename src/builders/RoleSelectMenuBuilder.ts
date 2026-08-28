import {
	ComponentType,
	SelectMenuDefaultValueType,
	type APIRoleSelectComponent,
	type APISelectMenuDefaultValue,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";

/** Shape describing initial role select menu data accepted by the builder. */
export type RoleSelectMenuBuilderData = {
	customId?: string;
	placeholder?: string;
	minValues?: number;
	maxValues?: number;
	disabled?: boolean;
	defaultValues?: APISelectMenuDefaultValue<SelectMenuDefaultValueType.Role>[];
};

/** Builder for Discord role select menu components. */
export class RoleSelectMenuBuilder
	implements JSONEncodable<APIRoleSelectComponent>
{
	private data: RoleSelectMenuBuilderData;

	/**
	 * Creates a new role select menu builder with optional seed data.
	 */
	constructor(data: RoleSelectMenuBuilderData = {}) {
		this.data = {
			customId: data.customId,
			placeholder: data.placeholder,
			minValues: data.minValues,
			maxValues: data.maxValues,
			disabled: data.disabled,
			defaultValues: data.defaultValues
				? data.defaultValues.map((value) => ({
						...value,
						type: SelectMenuDefaultValueType.Role,
				  }))
				: undefined,
		};
	}

	/**
	 * Sets the unique custom identifier for the select menu interaction.
	 */
	setCustomId(customId: string): this {
		this.data.customId = customId;
		return this;
	}

	/**
	 * Sets or clears the placeholder text displayed when no role is selected.
	 */
	setPlaceholder(placeholder: string | null | undefined): this {
		this.data.placeholder = placeholder ?? undefined;
		return this;
	}

	/**
	 * Sets the minimum number of roles that must be selected.
	 */
	setMinValues(minValues: number | null | undefined): this {
		this.data.minValues = minValues ?? undefined;
		return this;
	}

	/**
	 * Sets the maximum number of roles that can be selected.
	 */
	setMaxValues(maxValues: number | null | undefined): this {
		this.data.maxValues = maxValues ?? undefined;
		return this;
	}

	/**
	 * Toggles whether the select menu is disabled.
	 */
	setDisabled(disabled: boolean): this {
		this.data.disabled = disabled;
		return this;
	}

	/**
	 * Replaces the default role selections displayed when the menu renders.
	 */
	setDefaultValues(
		defaultValues: Iterable<
			APISelectMenuDefaultValue<SelectMenuDefaultValueType.Role>
		>,
	): this {
		this.data.defaultValues = Array.from(defaultValues, (value) => ({
			...value,
			type: SelectMenuDefaultValueType.Role,
		}));
		return this;
	}

	/**
	 * Serialises the builder into an API compatible role select menu payload.
	 */
	toJSON(): APIRoleSelectComponent {
		const { customId } = this.data;
		if (!customId) {
			throw new Error("[RoleSelectMenuBuilder] custom id is required.");
		}

		if (this.data.placeholder && this.data.placeholder.length > 150) {
			throw new Error(
				"[RoleSelectMenuBuilder] placeholder must be 150 characters or less.",
			);
		}

		return {
			type: ComponentType.RoleSelect,
			custom_id: customId,
			placeholder: this.data.placeholder,
			min_values: this.data.minValues,
			max_values: this.data.maxValues,
			disabled: this.data.disabled,
			default_values: this.data.defaultValues?.map((value) => ({
				...value,
				type: SelectMenuDefaultValueType.Role,
			})),
		};
	}
}
