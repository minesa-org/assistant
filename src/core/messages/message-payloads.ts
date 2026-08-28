import { MessageFlags } from "discord-api-types/v10";

import type { APIAllowedMentions, ChannelType } from "discord-api-types/v10";

import { InteractionFlags } from "../../types/InteractionFlags.js";
import {
	normaliseInteractionMessageData,
	type InteractionMessageData,
	type MessageFlagLike,
} from "../../utils/interactionMessageHelpers.js";

export type DiscordMessageFile = {
	name: string;
	data: ArrayBuffer | Blob | Buffer | Uint8Array;
	contentType?: string;
};

/** Reference to an existing message used for replies. */
export type DiscordMessageReference = {
	messageId: string;
	channelId?: string;
	failIfNotExists?: boolean;
};

/** A single answer of a poll. */
export type DiscordPollAnswer = {
	text: string;
	emoji?: { id?: string; name?: string; animated?: boolean };
};

/** Poll attached to a message send payload. */
export type DiscordPollSpec = {
	question: { text: string };
	answers: DiscordPollAnswer[];
	/** How long the poll stays open, in hours (1–768, default 24). */
	durationHours?: number;
	allowMultiselect?: boolean;
};

export type BaseDiscordMessageOptions = Omit<InteractionMessageData, "flags"> & {
	flags?: MessageFlagLike | MessageFlagLike[];
	allowedMentions?: APIAllowedMentions;
	attachments?: Array<Record<string, unknown>>;
	stickerIds?: string[];
	files?: DiscordMessageFile[];
	/** Attaches a poll to this message. */
	poll?: DiscordPollSpec;
	/** Sends this message as a reply when provided. */
	messageReference?: DiscordMessageReference;
};

export type DiscordSendMessageOptions = BaseDiscordMessageOptions & {
	channelId: string;
};

export type DiscordStartThreadOptions = {
	channelId: string;
	messageId: string;
	name: string;
	autoArchiveDuration?: number;
	rateLimitPerUser?: number;
	reason?: string;
};

export type DiscordWebhookSendOptions = BaseDiscordMessageOptions & {
	threadId?: string;
	username?: string;
	avatarUrl?: string;
};

/** Partial edit payload for channels (thread fields only apply to threads). */
export type DiscordChannelEditOptions = {
	name?: string;
	topic?: string;
	nsfw?: boolean;
	rateLimitPerUser?: number;
	/** Thread only: whether the thread is archived. */
	archived?: boolean;
	/** Thread only: whether the thread is locked. */
	locked?: boolean;
	/** Thread only: auto-archive duration in minutes. */
	autoArchiveDuration?: number;
};

/** Options for creating a thread directly in a channel (no source message). */
export type DiscordCreateThreadOptions = {
	channelId: string;
	name: string;
	autoArchiveDuration?: number;
	rateLimitPerUser?: number;
	/** Thread type; e.g. `ChannelType.PrivateThread` (12). Defaults per channel context. */
	type?: ChannelType;
	/** Whether the thread is invitable by non-moderators; private threads only. */
	invitable?: boolean;
	reason?: string;
};

export type DiscordReaction =
	| string
	| {
			name: string;
			id?: string;
			animated?: boolean;
	  };

export function normaliseDiscordMessagePayload(
	options: BaseDiscordMessageOptions,
): Record<string, unknown> {
	const payload = normaliseInteractionMessageData({
		content: options.content,
		components: options.components,
		embeds: options.embeds,
		flags: options.flags,
	}) as Record<string, unknown> | undefined;

	const resolvedPayload: Record<string, unknown> = payload ? { ...payload } : {};

	const flags = resolvedPayload.flags;
	if (typeof flags === "number" && (flags & MessageFlags.Ephemeral) === MessageFlags.Ephemeral) {
		throw new Error(
			"[MiniInteraction] Ephemeral flags are not supported for regular channel or webhook messages.",
		);
	}

	if (options.allowedMentions) {
		resolvedPayload.allowed_mentions = options.allowedMentions;
	}

	if (options.messageReference) {
		const { messageId, channelId, failIfNotExists } = options.messageReference;
		resolvedPayload.message_reference = {
			message_id: messageId,
			...(channelId ? { channel_id: channelId } : {}),
			...(failIfNotExists !== undefined ? { fail_if_not_exists: failIfNotExists } : {}),
		};
	}

	if (options.poll) {
		const { question, answers, durationHours, allowMultiselect } = options.poll;
		resolvedPayload.poll = {
			question,
			answers: answers.map((answer) => ({
				poll_media: {
					text: answer.text,
					...(answer.emoji ? { emoji: answer.emoji } : {}),
				},
			})),
			...(durationHours !== undefined ? { duration: durationHours } : {}),
			...(allowMultiselect !== undefined
				? { allow_multiselect: allowMultiselect }
				: {}),
		};
	}

	if (options.stickerIds && options.stickerIds.length > 0) {
		resolvedPayload.sticker_ids = options.stickerIds;
	}

	// Components V2 messages cannot be mixed with legacy content fields.
	const resolvedFlags = Number(resolvedPayload.flags ?? 0);
	if ((resolvedFlags & InteractionFlags.IsComponentsV2) === InteractionFlags.IsComponentsV2) {
		const forbiddenFields: string[] = [];
		if (resolvedPayload.content !== undefined && resolvedPayload.content !== null) forbiddenFields.push("content");
		if (resolvedPayload.embeds !== undefined && resolvedPayload.embeds !== null) forbiddenFields.push("embeds");
		if (resolvedPayload.sticker_ids !== undefined) forbiddenFields.push("sticker_ids");

		if (forbiddenFields.length > 0) {
			throw new Error(
				`[MiniInteraction] ${forbiddenFields.join(", ")} cannot be used together with the IsComponentsV2 flag. Use TextDisplay components instead.`,
			);
		}
	}

	const files = options.files ?? [];
	if (options.attachments && options.attachments.length > 0) {
		resolvedPayload.attachments = options.attachments;
	} else if (files.length > 0) {
		resolvedPayload.attachments = files.map((file, index) => ({
			id: String(index),
			filename: file.name,
		}));
	}

	return resolvedPayload;
}

export function createMessageRequestInit(
	options: BaseDiscordMessageOptions,
): {
	body: BodyInit;
	headers?: HeadersInit;
} {
	const payload = normaliseDiscordMessagePayload(options);
	const files = options.files ?? [];

	if (files.length === 0) {
		return {
			body: JSON.stringify(payload),
			headers: {
				"Content-Type": "application/json",
			},
		};
	}

	const formData = new FormData();
	formData.set("payload_json", JSON.stringify(payload));

	files.forEach((file, index) => {
		formData.append(`files[${index}]`, toBlob(file), file.name);
	});

	return { body: formData };
}

function toBlob(file: DiscordMessageFile): Blob {
	if (file.data instanceof Blob) {
		return file.data;
	}

	if (file.data instanceof ArrayBuffer) {
		return new Blob(
			[file.data],
			file.contentType ? { type: file.contentType } : undefined,
		);
	}

	const bytes = Uint8Array.from(file.data as ArrayLike<number>);

	return new Blob([bytes.buffer], file.contentType ? { type: file.contentType } : undefined);
}
