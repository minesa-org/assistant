import type { APIChannel, APIMessage } from "discord-api-types/v10";

import type { DiscordRestClient } from "../http/DiscordRestClient.js";
import type {
	BaseDiscordMessageOptions,
	DiscordReaction,
	DiscordSendMessageOptions,
	DiscordStartThreadOptions,
} from "./message-payloads.js";

/**
 * Wrapper around a message returned by the API with chainable helpers for
 * editing, deleting, replying, reacting and threading.
 */
export class DiscordSentMessage {
	constructor(
		private readonly rest: DiscordRestClient,
		public readonly raw: APIMessage,
	) {}

	get id(): string {
		return this.raw.id;
	}

	get channelId(): string {
		return this.raw.channel_id;
	}

	async startThread(
		options: Omit<DiscordStartThreadOptions, "channelId" | "messageId">,
	): Promise<APIChannel> {
		return this.rest.startThread({
			channelId: this.channelId,
			messageId: this.id,
			...options,
		});
	}

	async react(reaction: DiscordReaction): Promise<this> {
		await this.rest.addReaction(this.channelId, this.id, reaction);
		return this;
	}

	/** Edits this message. Requires the bot to be the author (or manage messages for system flags). */
	async edit(options: BaseDiscordMessageOptions): Promise<DiscordSentMessage> {
		return this.rest.editMessage(this.channelId, this.id, options);
	}

	/** Deletes this message. */
	async delete(reason?: string): Promise<void> {
		await this.rest.deleteMessage(this.channelId, this.id, reason);
	}

	/**
	 * Sends a new message in the same channel replying to this one.
	 * Accepts either plain message options or a bare string as shorthand for content.
	 */
	reply(
		options: BaseDiscordMessageOptions | string,
	): Promise<DiscordSentMessage> {
		const resolved: BaseDiscordMessageOptions =
			typeof options === "string" ? { content: options } : options;

		return this.rest.sendMessage({
			...(resolved as DiscordSendMessageOptions),
			channelId: this.channelId,
			messageReference: resolved.messageReference ?? { messageId: this.id },
		} satisfies DiscordSendMessageOptions);
	}

	/** Pins this message in its channel. */
	pin(reason?: string): Promise<void> {
		return this.rest.pinMessage(this.channelId, this.id, reason);
	}

	/** Unpins this message from its channel. */
	unpin(reason?: string): Promise<void> {
		return this.rest.unpinMessage(this.channelId, this.id, reason);
	}

	/** Publishes this message in an announcement channel to followers. */
	crosspost(): Promise<APIMessage> {
		return this.rest.crosspostMessage(this.channelId, this.id);
	}

	toJSON(): APIMessage {
		return this.raw;
	}
}
