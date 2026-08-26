import "dotenv/config";

import {
	DiscordRestClient,
	InteractionContext,
	InteractionRouter,
	verifyAndParseInteraction,
} from "@minesa-org/mini-interaction";

import { pingCommand } from "../src/commands/ping.js";
import { echoCommand } from "../src/commands/echo.js";
import { pingButton } from "../src/components/ping_button.js";
import { pingMenu } from "../src/components/ping_menu.js";
import { pingModal } from "../src/modals/ping_modal.js";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`Missing required environment variable "${name}" (see env.example).`,
		);
	}
	return value;
}

/**
 * Shared REST client used by the router for deferred edits and follow-ups.
 */
export const rest = new DiscordRestClient({
	applicationId: requireEnv("DISCORD_APPLICATION_ID"),
	token: requireEnv("DISCORD_BOT_TOKEN"),
});

/**
 * Explicit handler registration — no file-system discovery needed.
 * Add new commands/components/modals here.
 */
export const router = new InteractionRouter({ rest })
	.onCommand("ping", pingCommand.handler)
	.onCommand("echo", echoCommand.handler)
	.onComponent("ping_button", pingButton.handler)
	.onComponent("ping_menu", pingMenu.handler)
	.onModal("ping_modal", pingModal.handler)
	.onError(async (error, _interaction, ctx) => {
		console.error("[mini-app] interaction failed:", error);
		return ctx.reply({ content: "⚠️ Something went wrong." });
	});

/**
 * Vercel Web-standard interaction endpoint. Point your app's
 * "Interactions Endpoint URL" at `<deployment>/api/interactions`.
 */
export default async function handler(req: Request): Promise<Response> {
	if (req.method !== "POST") {
		return new Response(null, { status: 405 });
	}

	const signature = req.headers.get("x-signature-ed25519") ?? "";
	const timestamp = req.headers.get("x-signature-timestamp") ?? "";
	const body = await req.text();

	try {
		const interaction = await verifyAndParseInteraction({
			body,
			signature,
			timestamp,
			publicKey: requireEnv("DISCORD_PUBLIC_KEY"),
		});

		const ctx = new InteractionContext({ interaction, rest });
		const response = await router.dispatch(interaction, ctx);

		return Response.json(response ?? ctx.deferReply());
	} catch (error) {
		console.error("[mini-app] rejected interaction:", error);
		return new Response("Invalid request signature", { status: 401 });
	}
}
