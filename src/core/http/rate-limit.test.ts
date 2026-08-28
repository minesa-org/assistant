import { test } from "node:test";
import assert from "node:assert/strict";

import { DiscordRestClient } from "./DiscordRestClient.js";

const BASE = "https://discord.com/api/v10";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json", ...init?.headers },
		...init,
	});
}

test("retries a 429 using retry_after from the JSON body", async () => {
	let calls = 0;

	const rest = new DiscordRestClient({
		token: "t",
		applicationId: "app",
		maxRetries: 3,
		fetchImplementation: (async () => {
			calls += 1;
			if (calls === 1) {
				return new Response(JSON.stringify({ retry_after: 0.02 }), {
					status: 429,
					headers: { "Content-Type": "application/json" },
				});
			}
			return jsonResponse({ id: "1" });
		}) as typeof fetch,
	});

	const started = Date.now();
	const result = (await rest.request("/channels/123/messages", { method: 'POST' })) as { id: string };
	const elapsed = Date.now() - started;

	assert.equal(result.id, "1");
	assert.equal(calls, 2);
	assert.ok(elapsed >= 15, `expected to wait ~20ms, took ${elapsed}ms`);
});

test("waits before spending a call when the bucket budget is exhausted", async () => {
	let calls = 0;
	let resetAfterReturned = false;

	const rest = new DiscordRestClient({
		token: "t",
		applicationId: "app",
		fetchImplementation: (async () => {
			calls += 1;
			if (!resetAfterReturned) {
				resetAfterReturned = true;
				return jsonResponse({ ok: true }, {
					headers: {
						"x-ratelimit-bucket": "b1",
						"x-ratelimit-remaining": "0",
						"x-ratelimit-reset-after": "0.03",
					},
				});
			}
			return jsonResponse({ ok: true });
		}) as typeof fetch,
	});

	// First call learns the bucket is exhausted.
	await rest.request("/channels/999/messages");

	// Second call on the same route must wait out the bucket reset.
	const started = Date.now();
	await rest.request("/channels/999/messages");
	const elapsed = Date.now() - started;

	assert.equal(calls, 2);
	assert.ok(elapsed >= 25, `expected ~30ms wait, took ${elapsed}ms`);
});

test("different major parameters use independent buckets", async () => {
	const routesHit: string[] = [];

	const rest = new DiscordRestClient({
		token: "t",
		applicationId: "app",
		fetchImplementation: (async (_url: RequestInfo | URL) => {
			routesHit.push(String(_url).replace(BASE, ""));
			return jsonResponse({ ok: true }, {
				headers: {
					"x-ratelimit-bucket": "b1",
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset-after": "60",
				},
			});
		}) as typeof fetch,
	});

	// Exhaust the budget for channel A...
	const started = Date.now();
	await rest.request("/channels/A/messages");
	// ...channel B shares the same bucket id but is a different major param,
	// so it must NOT wait out channel A's reset window.
	await rest.request("/channels/B/messages");

	assert.ok(Date.now() - started < 1000, "should not have waited out the reset");
	assert.equal(routesHit.length, 2);
});
