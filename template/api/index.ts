import { readFile } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";

import { generateOAuthUrl } from "@minesa-org/mini-interaction";

/**
 * Linked-roles landing page. Renders `index.html` and redirects the visitor
 * to Discord's OAuth consent screen via the {{OAUTH_URL_RAW}} placeholder.
 */
export default async function handler(_req: Request): Promise<Response> {
	const appId = process.env.DISCORD_APPLICATION_ID;
	const appSecret = process.env.DISCORD_CLIENT_SECRET;
	const redirectUri = process.env.DISCORD_REDIRECT_URI;

	if (!appId || !appSecret || !redirectUri) {
		return new Response(
			"Missing DISCORD_APPLICATION_ID, DISCORD_CLIENT_SECRET or DISCORD_REDIRECT_URI.",
			{ status: 500 },
		);
	}

	const { url, state } = generateOAuthUrl(
		{ appId, appSecret, redirectUri },
		["applications.commands", "identify", "guilds", "role_connections.write"],
	);

	const htmlFile = path.join(process.cwd(), "index.html");
	const html = (await readFile(htmlFile, "utf8")).replaceAll(
		"{{OAUTH_URL_RAW}}",
		url,
	);

	return new Response(html, {
		status: 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"set-cookie": `mini_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`,
		},
	});
}
