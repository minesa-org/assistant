import { test } from "node:test";
import assert from "node:assert/strict";

import {
	avatarURL,
	defaultAvatarURL,
	guildIconURL,
	emojiURL,
	stickerURL,
	attachmentURL,
} from "./cdn.js";

test("avatar URL defaults to png and gif for animated hashes", () => {
	assert.equal(
		avatarURL("111", "abc123"),
		"https://cdn.discordapp.com/avatars/111/abc123.png",
	);
	assert.equal(
		avatarURL("111", "a_abc123"),
		"https://cdn.discordapp.com/avatars/111/a_abc123.gif",
	);
	assert.equal(
		avatarURL("111", "abc123", { format: "webp", size: 512 }),
		"https://cdn.discordapp.com/avatars/111/abc123.webp?size=512",
	);
});

test("default avatar derives the index from the user id", () => {
	assert.equal(defaultAvatarURL(0), "https://cdn.discordapp.com/embed/avatars/0.png");
	// (id >> 22) % 6 — deterministic per user id
	const url = defaultAvatarURL("175994302537908224");
	assert.match(url, /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/);
});

test("guild icon and emoji urls", () => {
	assert.equal(
		guildIconURL("222", "iconhash"),
		"https://cdn.discordapp.com/icons/222/iconhash.png",
	);
	assert.equal(
		emojiURL("333", true),
		"https://cdn.discordapp.com/emojis/333.gif",
	);
	assert.equal(stickerURL("444"), "https://cdn.discordapp.com/stickers/444.png");
});

test("attachment URL encodes the filename", () => {
	assert.equal(
		attachmentURL("555", "666", "my file.png"),
		"https://media.discordapp.net/attachments/555/666/my%20file.png",
	);
});
