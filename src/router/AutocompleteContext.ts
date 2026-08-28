import {
	InteractionResponseType,
	type APIApplicationCommandAutocompleteInteraction,
	type APIApplicationCommandInteractionDataOption,
	type APIApplicationCommandOptionChoice,
	type APIInteractionResponse,
} from "discord-api-types/v10";

/** A focused (currently-typed) option inside an autocomplete interaction. */
export type FocusedOption = {
	name: string;
	value: string;
	type: number;
	subcommandGroup?: string;
	subcommand?: string;
};

/**
 * Context for autocomplete interactions (`InteractionType.ApplicationCommandAutocomplete`).
 * Collects up to 25 choice suggestions and produces the `type: 8` response.
 */
export class AutocompleteContext {
	private responded = false;
	private autocompleteResponse?: APIInteractionResponse;

	constructor(
		private readonly interaction: APIApplicationCommandAutocompleteInteraction,
	) {}

	/** Name of the command being autocompleted. */
	get commandName(): string {
		return this.interaction.data.name;
	}

	get hasResponded(): boolean {
		return this.responded;
	}

	/** The raw response produced by {@link respond}, if any. */
	get result(): APIInteractionResponse | undefined {
		return this.autocompleteResponse;
	}

	/**
	 * Finds the option the user is currently typing in.
	 *
	 * @param required - Throw when no focused option exists instead of returning null.
	 */
	getFocusedOption(required = true): FocusedOption | null {
		const found = this.search(this.interaction.data.options ?? []);

		if (!found) {
			if (required) {
				throw new Error(
					"[MiniInteraction] No focused option on this autocomplete interaction.",
				);
			}
			return null;
		}

		return found;
	}

	/**
	 * Answers the autocomplete request with up to 25 choices.
	 * Plain strings are accepted as shorthand for `{ name, value }` pairs.
	 */
	respond(
		choices: ReadonlyArray<string | APIApplicationCommandOptionChoice>,
	): APIInteractionResponse {
		if (!Array.isArray(choices)) {
			throw new Error("[MiniInteraction] Autocomplete choices must be an array.");
		}

		this.responded = true;
		this.autocompleteResponse = {
			type: InteractionResponseType.ApplicationCommandAutocompleteResult,
			data: {
				choices: choices
					.slice(0, 25)
					.map((choice) =>
						typeof choice === "string"
							? { name: choice, value: choice }
							: { ...choice },
					),
			},
		};

		return this.autocompleteResponse;
	}

	private search(
		options: readonly APIApplicationCommandInteractionDataOption[],
		path: { subcommand?: string; subcommandGroup?: string } = {},
	): FocusedOption | null {
		for (const option of options) {
			if ("focused" in option && option.focused) {
				return {
					name: option.name,
					value: String(option.value),
					type: option.type,
					subcommandGroup: path.subcommandGroup,
					subcommand: path.subcommand,
				};
			}

			if ("options" in option && Array.isArray(option.options)) {
				const nested = this.search(option.options, {
					subcommandGroup:
						option.type === 2 /* SubcommandGroup */ ? option.name : path.subcommandGroup,
					subcommand:
						option.type === 1 /* Subcommand */ ? option.name : path.subcommand,
				});
				if (nested) return nested;
			}
		}

		return null;
	}
}
