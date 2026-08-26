import { test } from "node:test";
import assert from "node:assert/strict";

import { DiscordRestClient } from "./DiscordRestClient.js";
import type { ApplicationCommandPermissionType } from "discord-api-types/v10";

const BASE = "https://discord.com/api/v10";

type CapturedCall = { path: string; method?: string; body?: unknown; reason?: string };

function makeRest() {
	const calls: CapturedCall[] = [];

	const rest = new DiscordRestClient({
		token: "bot-token",
		applicationId: "app-1",
		fetchImplementation: (async (_url: RequestInfo | URL, init?: RequestInit) => {
			calls.push({
				path: String(_url).replace(BASE, ""),
				method: init?.method,
				body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
				reason:
					(init?.headers as Record<string, string> | undefined)?.["X-Audit-Log-Reason"],
			});
			return new Response("{}", { status: 200 });
		}) as typeof fetch,
	});

	return { rest, calls };
}

test("bulkDeleteMessages rejects batches outside 2-100", async () => {
	const { rest } = makeRest();
	await assert.rejects(
		() => rest.bulkDeleteMessages("ch", ["1"]),
		/between 2 and 100/,
	);
	await assert.rejects(
		() => rest.bulkDeleteMessages("ch", Array.from({ length: 101 }, (_, i) => String(i))),
		/between 2 and 100/,
	);
});

test("fetchMessages forwards pagination query params", async () => {
	const { rest, calls } = makeRest();
	await rest.fetchMessages("ch", { limit: 50, before: "10" });

	assert.equal(calls[0].path, "/channels/ch/messages?limit=50&before=10");
});

test("banMember sends PUT with delete_message_seconds and audit reason", async () => {
	const { rest, calls } = makeRest();
	await rest.banMember("g", "u", { deleteMessageSeconds: 86400, reason: "spam" });

	assert.equal(calls[0].path, "/guilds/g/bans/u");
	assert.equal(calls[0].method, "PUT");
	assert.deepEqual(calls[0].body, { delete_message_seconds: 86400 });
	assert.equal(calls[0].reason, "spam");
});

test("timeoutMember maps duration to an ISO communication_disabled_until", async () => {
	const { rest, calls } = makeRest();

	await rest.timeoutMember("g", "u", 60_000, "cool down");
	const sent = calls[0].body as { communication_disabled_until: string };
	assert.ok(new Date(sent.communication_disabled_until) > new Date(Date.now() + 55_000));

	// null clears the timeout
	await rest.timeoutMember("g", "u", null);
	assert.equal(
		(calls[1].body as { communication_disabled_until: string | null })
			.communication_disabled_until,
		null,
	);
});

test("role CRUD builds snake_case payloads", async () => {
	const { rest, calls } = makeRest();

	await rest.createRole("g", { name: "Mods", color: 0xff0000, hoist: true }, "why not");
	assert.equal(calls[0].method, "POST");
	assert.deepEqual(calls[0].body, { name: "Mods", color: 16711680, hoist: true });
	assert.equal(calls[0].reason, "why not");

	await rest.addRoleToMember("g", "u", "r");
	assert.equal(calls[1].path, "/guilds/g/members/u/roles/r");
	assert.equal(calls[1].method, "PUT");

	await rest.removeRoleFromMember("g", "u", "r");
	assert.equal(calls[2].method, "DELETE");

	await rest.reorderRoles("g", [
		{ id: "a", position: 1 },
		{ id: "b", position: 2 },
	]);
	assert.deepEqual(calls[3].body, [
		{ id: "a", position: 1 },
		{ id: "b", position: 2 },
	]);
});

test("webhook creation and token-less fetch use the right routes", async () => {
	const { rest, calls } = makeRest();

	await rest.createWebhook("ch", { name: "Logger" });
	assert.equal(calls[0].method, "POST");
	assert.deepEqual(calls[0].body, { name: "Logger" });

	await rest.fetchWebhookWithToken("wid", "wtok");
	assert.equal(calls[1].path, "/webhooks/wid/wtok");
});

test("entitlement listing builds filters and consume hits the route", async () => {
	const { rest, calls } = makeRest();

	await rest.listEntitlements({ userId: "u1", skuIds: ["sku1", "sku2"], excludeEnded: true });
	assert.equal(
		calls[0].path,
		"/applications/app-1/entitlements?user_id=u1&sku_ids=sku1%2Csku2&exclude_ended=true",
	);

	await rest.consumeEntitlement("e1");
	assert.equal(calls[1].path, "/applications/app-1/entitlements/e1/consume");
	assert.equal(calls[1].method, "POST");
});

test("command permission sets PUT the full override list", async () => {
	const { rest, calls } = makeRest();
	const permissions = [
		{ id: "r1", type: 1 as ApplicationCommandPermissionType, permission: true },
	];

	await rest.setCommandPermissions("g", "cmd", permissions);
	assert.equal(
		calls[0].path,
		"/applications/app-1/guilds/g/commands/cmd/permissions",
	);
	assert.equal(calls[0].method, "PUT");
	assert.deepEqual(calls[0].body, { permissions });
});

test("poll lifecycle endpoints", async () => {
	const { rest, calls } = makeRest();

	await rest.endPoll("ch", "m");
	assert.equal(calls[0].path, "/channels/ch/polls/m/expire");
	assert.equal(calls[0].method, "POST");

	await rest.fetchPollAnswerVoters("ch", "m", 2);
	assert.equal(calls[1].path, "/channels/ch/polls/m/answers/2/voters");
});
