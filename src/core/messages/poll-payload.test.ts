import { test } from "node:test";
import assert from "node:assert/strict";

import { normaliseDiscordMessagePayload } from "./message-payloads.js";

test("poll specs map to the API poll object", () => {
	const payload = normaliseDiscordMessagePayload({
		poll: {
			question: { text: "Pineapple on pizza?" },
			answers: [
				{ text: "Yes" },
				{ text: "No", emoji: { name: "🍕" } },
			],
			durationHours: 48,
			allowMultiselect: false,
		},
	});

	assert.deepEqual(payload.poll, {
		question: { text: "Pineapple on pizza?" },
		answers: [
			{ poll_media: { text: "Yes" } },
			{ poll_media: { text: "No", emoji: { name: "🍕" } } },
		],
		duration: 48,
		allow_multiselect: false,
	});
});
