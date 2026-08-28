import { test } from "node:test";
import assert from "node:assert/strict";
import { AllowedMentionsTypes } from "discord-api-types/v10";

import { normaliseDiscordMessagePayload } from "./message-payloads.js";
import { ContainerBuilder, TextDisplayBuilder } from "../../builders/index.js";

test("maps camelCase options to snake_case API fields", () => {
	const payload = normaliseDiscordMessagePayload({
		content: "hello",
		allowedMentions: { parse: [AllowedMentionsTypes.User] },
		stickerIds: ["1"],
		messageReference: { messageId: "999", failIfNotExists: false },
	});

	assert.equal(payload.content, "hello");
	assert.deepEqual(payload.allowed_mentions, { parse: ["users"] });
	assert.deepEqual(payload.sticker_ids, ["1"]);
	assert.deepEqual(payload.message_reference, {
		message_id: "999",
		fail_if_not_exists: false,
	});
});

test("auto-sets IsComponentsV2 flag when V2 components are present", () => {
	const payload = normaliseDiscordMessagePayload({
		components: [
			new ContainerBuilder().addComponent(
				new TextDisplayBuilder().setContent("hi"),
			),
		],
	});

	assert.equal(Number(payload.flags) & 32768, 32768);
});

test("rejects content/embeds/stickers combined with Components V2", () => {
	assert.throws(
		() =>
			normaliseDiscordMessagePayload({
				content: "x",
				flags: 32768,
			}),
		/IsComponentsV2/,
	);

	assert.throws(
		() =>
			normaliseDiscordMessagePayload({
				stickerIds: ["1"],
				flags: 32768,
			}),
		/IsComponentsV2/,
	);
});

test("rejects ephemeral flag on channel/webhook messages", () => {
	assert.throws(
		() => normaliseDiscordMessagePayload({ content: "x", flags: 64 }),
		/Ephemeral/,
	);
});

test("files produce attachment metadata for multipart uploads", () => {
	const payload = normaliseDiscordMessagePayload({
		files: [{ name: "a.png", data: new Uint8Array([1]) }],
	});

	assert.deepEqual(payload.attachments, [
		{ id: "0", filename: "a.png" },
	]);
});
