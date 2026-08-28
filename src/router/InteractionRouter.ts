import {
	ApplicationCommandType,
	InteractionType,
	type APIInteraction,
	type APIInteractionResponse,
} from "discord-api-types/v10";

import { DiscordRestClient } from "../core/http/DiscordRestClient.js";
import { InteractionContext } from "../core/interactions/InteractionContext.js";
import {
	CommandInteraction,
	createCommandInteraction,
} from "../utils/CommandInteractionOptions.js";
import {
	AppCommandInteraction,
	MessageContextMenuInteraction,
	UserContextMenuInteraction,
	createAppCommandInteraction,
	createMessageContextMenuInteraction,
	createUserContextMenuInteraction,
} from "../utils/ContextMenuInteraction.js";
import {
	MessageComponentInteraction,
	createMessageComponentInteraction,
} from "../utils/MessageComponentInteraction.js";
import {
	ModalSubmitInteraction,
	createModalSubmitInteraction,
} from "../utils/ModalSubmitInteraction.js";

import { AutocompleteContext } from "./AutocompleteContext.js";

/** Handler for chat-input (slash) commands. */
export type ChatInputHandler = (
	interaction: CommandInteraction,
	ctx: InteractionContext,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler for User context menu commands. */
export type UserMenuHandler = (
	interaction: UserContextMenuInteraction,
	ctx: InteractionContext,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler for Message context menu commands. */
export type MessageMenuHandler = (
	interaction: MessageContextMenuInteraction,
	ctx: InteractionContext,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler for Primary Entry Point commands. */
export type EntryPointHandler = (
	interaction: AppCommandInteraction,
	ctx: InteractionContext,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler for message components (buttons, selects, ...). */
export type ComponentHandler = (
	interaction: MessageComponentInteraction,
	ctx: InteractionContext,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler for modal submissions. */
export type ModalHandler = (
	interaction: ModalSubmitInteraction,
	ctx: InteractionContext,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler for autocomplete requests. */
export type AutocompleteHandler = (
	interaction: AutocompleteContext,
	ctx: InteractionContext,
) => Promise<void> | void;

/** Middleware executed before dispatch; call `next()` to continue the chain. */
export type RouterMiddleware = (
	interaction: APIInteraction,
	ctx: InteractionContext,
	next: () => Promise<APIInteractionResponse | void>,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Error hook; return a response to answer the interaction gracefully. */
export type RouterErrorHandler = (
	error: unknown,
	interaction: APIInteraction,
	ctx: InteractionContext,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Fallback invoked when no handler matches an interaction. */
export type RouterFallback = (
	interaction: APIInteraction,
	ctx: InteractionContext,
) => APIInteractionResponse | void;

type CommandEntry = {
	type: ApplicationCommandType;
	handler:
		| ChatInputHandler
		| UserMenuHandler
		| MessageMenuHandler
		| EntryPointHandler;
};

type ComponentEntry = {
	matcher: string | RegExp;
	handler: ComponentHandler;
};

export type InteractionRouterOptions = {
	/** Optional REST client used to commit deferred edits/follow-ups automatically. */
	rest?: DiscordRestClient;
};

/**
 * Dispatches interactions to registered handlers with support for chat-input
 * commands, context menus, primary entry points, components, modals and
 * autocomplete — including middleware, error hooks and pattern-based custom ids.
 */
export class InteractionRouter {
	private readonly commandHandlers = new Map<string, CommandEntry>();
	private readonly componentEntries: ComponentEntry[] = [];
	private readonly modalHandlers = new Map<string, ModalHandler>();
	private readonly autocompleteHandlers = new Map<string, AutocompleteHandler>();
	private readonly middleware: RouterMiddleware[] = [];

	private errorHandler?: RouterErrorHandler;
	private fallbackHandler?: RouterFallback;

	constructor(private readonly options: InteractionRouterOptions = {}) {}

	onCommand(name: string, handler: ChatInputHandler): this {
		this.commandHandlers.set(name, { type: ApplicationCommandType.ChatInput, handler });
		return this;
	}

	/** Registers a User context menu command handler. */
	onUserCommand(name: string, handler: UserMenuHandler): this {
		this.commandHandlers.set(name, { type: ApplicationCommandType.User, handler });
		return this;
	}

	/** Registers a Message context menu command handler. */
	onMessageCommand(name: string, handler: MessageMenuHandler): this {
		this.commandHandlers.set(name, { type: ApplicationCommandType.Message, handler });
		return this;
	}

	/** Registers a Primary Entry Point command handler. */
	onEntryPointCommand(name: string, handler: EntryPointHandler): this {
		this.commandHandlers.set(name, { type: ApplicationCommandType.PrimaryEntryPoint, handler });
		return this;
	}

	/**
	 * Registers a component handler. Exact custom ids take priority over
	 * patterns; glob patterns (`config:*`) match by longest prefix, regexes
	 * are tested in registration order.
	 */
	onComponent(customIdOrPattern: string | RegExp, handler: ComponentHandler): this {
		this.componentEntries.push({ matcher: customIdOrPattern, handler });
		return this;
	}

	onModal(customId: string, handler: ModalHandler): this {
		this.modalHandlers.set(customId, handler);
		return this;
	}

	/** Registers an autocomplete handler for a chat-input command name. */
	onAutocomplete(commandName: string, handler: AutocompleteHandler): this {
		this.autocompleteHandlers.set(commandName, handler);
		return this;
	}

	/** Adds middleware that runs before dispatch. Call `next()` to continue. */
	use(middleware: RouterMiddleware): this {
		this.middleware.push(middleware);
		return this;
	}

	/** Sets the error hook used when a handler or middleware throws. */
	onError(handler: RouterErrorHandler): this {
		this.errorHandler = handler;
		return this;
	}

	/** Sets the fallback used when no handler matches (e.g. a default defer). */
	onFallback(handler: RouterFallback): this {
		this.fallbackHandler = handler;
		return this;
	}

	async dispatch(
		interaction: APIInteraction,
		ctx: InteractionContext,
	): Promise<APIInteractionResponse | void> {
		try {
			let index = -1;
			const run = async (): Promise<APIInteractionResponse | void> => {
				index += 1;
				if (index < this.middleware.length) {
					return this.middleware[index](interaction, ctx, run);
				}
				return this.handle(interaction, ctx);
			};

			return await run();
		} catch (error) {
			if (!this.errorHandler) throw error;
			return this.errorHandler(error, interaction, ctx);
		}
	}

	private async handle(
		interaction: APIInteraction,
		ctx: InteractionContext,
	): Promise<APIInteractionResponse | void> {			if (interaction.type === InteractionType.ApplicationCommand) {
				const entry =
					interaction.data.name !== undefined
						? this.commandHandlers.get(interaction.data.name)
						: undefined;

				if (!entry || entry.type !== interaction.data.type) {
					return this.fallbackHandler?.(interaction, ctx);
				}

				const captured: APIInteractionResponse[] = [];
				const helpers = this.buildHelpers(captured);
				let result: APIInteractionResponse | void;

				switch (interaction.data.type) {
					case ApplicationCommandType.ChatInput:
						result = await (entry.handler as ChatInputHandler)(
							createCommandInteraction(interaction as never, helpers),
							ctx,
						);
						break;
					case ApplicationCommandType.User:
						result = await (entry.handler as UserMenuHandler)(
							createUserContextMenuInteraction(interaction as never, helpers),
							ctx,
						);
						break;
					case ApplicationCommandType.Message:
						result = await (entry.handler as MessageMenuHandler)(
							createMessageContextMenuInteraction(interaction as never, helpers),
							ctx,
						);
						break;
					case ApplicationCommandType.PrimaryEntryPoint:
						result = await (entry.handler as EntryPointHandler)(
							createAppCommandInteraction(interaction as never, helpers),
							ctx,
						);
						break;
					default:
						return this.fallbackHandler?.(interaction, ctx);
				}

				return result ?? captured[0];
			}

		if (interaction.type === InteractionType.MessageComponent) {
			const handler = this.matchComponent(interaction.data.custom_id);
			if (!handler) return this.fallbackHandler?.(interaction, ctx);

			const captured: APIInteractionResponse[] = [];
			const wrapped = createMessageComponentInteraction(interaction, this.buildHelpers(captured));
			const result = await handler(wrapped, ctx);
			return result ?? captured[0];
		}

		if (interaction.type === InteractionType.ModalSubmit) {
			const handler = this.modalHandlers.get(interaction.data.custom_id);
			if (!handler) return this.fallbackHandler?.(interaction, ctx);

			const captured: APIInteractionResponse[] = [];
			const wrapped = createModalSubmitInteraction(interaction, this.buildHelpers(captured));
			const result = await handler(wrapped, ctx);
			return result ?? captured[0];
		}

		if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
			const handler = this.autocompleteHandlers.get(interaction.data.name);
			if (!handler) return this.fallbackHandler?.(interaction, ctx);

			const autocomplete = new AutocompleteContext(interaction);
			await handler(autocomplete, ctx);
			return autocomplete.result;
		}

		return this.fallbackHandler?.(interaction, ctx);
	}

	/**
	 * Resolves a component handler: exact id first, then glob prefix patterns
	 * (longest prefix wins), then regex patterns in registration order.
	 */
	private matchComponent(customId: string): ComponentHandler | undefined {
		for (const entry of this.componentEntries) {
			if (typeof entry.matcher === "string" && entry.matcher === customId) {
				return entry.handler;
			}
		}

		let bestGlob: { matcher: string; handler: ComponentHandler } | undefined;
		for (const entry of this.componentEntries) {
			if (typeof entry.matcher === "string" && entry.matcher.endsWith("*")) {
				const prefix = entry.matcher.slice(0, -1);
				if (customId.startsWith(prefix)) {
					if (!bestGlob || prefix.length > bestGlob.matcher.length - 1) {
						bestGlob = { matcher: entry.matcher, handler: entry.handler };
					}
				}
			}
		}
		if (bestGlob) return bestGlob.handler;

		for (const entry of this.componentEntries) {
			if (entry.matcher instanceof RegExp && entry.matcher.test(customId)) {
				return entry.handler;
			}
		}

		return undefined;
	}

	private buildHelpers(captured: APIInteractionResponse[]) {
		return {
			canRespond: (_interactionId: string) => true,
			trackResponse: () => {},
			onAck: (response: APIInteractionResponse) => {
				if (!captured.includes(response)) captured.push(response);
			},
			sendFollowUp: this.options.rest
				? async (
						token: string,
						response: APIInteractionResponse,
						messageId?: string,
					) => {
						const rest = this.options.rest!;
						const data = "data" in response ? response.data ?? {} : {};
						if (messageId === "@original") {
							await rest.editOriginal(token, data);
						} else {
							await rest.createFollowup(token, data);
						}
					}
				: undefined,
		};
	}
}
