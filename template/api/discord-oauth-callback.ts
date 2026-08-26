import { readFile } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";

import {
	getDiscordUser,
	getOAuthTokens,
	MiniDatabase,
} from "@minesa-org/mini-interaction";

import { updateDiscordMetadata } from "../src/utils/database.js";

const database = MiniDatabase.fromEnv();

function oauthConfig() {
	const appId = process.env.DISCORD_APPLICATION_ID;
	const appSecret = process.env.DISCORD_CLIENT_SECRET;
	const redirectUri = process.env.DISCORD_REDIRECT_URI;

	if (!appId || !appSecret || !redirectUri) {
		throw new Error(
			"Missing DISCORD_APPLICATION_ID, DISCORD_CLIENT_SECRET or DISCORD_REDIRECT_URI.",
		);
	}

	return { appId, appSecret, redirectUri };
}

async function renderPage(file: string, status = 200): Promise<Response> {
	const html = await readFile(
		path.join(process.cwd(), file),
		"utf8",
	);
	return new Response(html, {
		status,
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

function getCookie(req: Request, name: string): string | undefined {
	const header = req.headers.get("cookie");
	if (!header) return undefined;

	for (const part of header.split(";")) {
		const [key, ...value] = part.trim().split("=");
		if (key === name) return decodeURIComponent(value.join("="));
	}

	return undefined;
}

/**
 * OAuth2 callback. Exchanges the code, stores tokens in MiniDatabase and
 * writes the `is_miniapp` role-connection metadata for the user.
 */
export default async function handler(req: Request): Promise<Response> {
	try {
		const url = new URL(req.url);
		const error = url.searchParams.get("error");
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const cookieState = getCookie(req, "mini_oauth_state");

		if (error || !code) return renderPage("public/pages/failed.html");
		if (state && cookieState && state !== cookieState) {
			return renderPage("public/pages/failed.html");
		}

		const tokens = await getOAuthTokens(code, oauthConfig());
		const user = await getDiscordUser(tokens.access_token);

		await database.set(user.id, {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			expiresAt: tokens.expires_at,
			scope: tokens.scope,
		});

		await updateDiscordMetadata(user.id, tokens.access_token);

		return renderPage("public/pages/connected.html");
	} catch (error) {
		console.error("[mini-app] oauth callback failed:", error);
		return renderPage("public/pages/failed.html", 500);
	}
}
