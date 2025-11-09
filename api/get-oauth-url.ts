import type { IncomingMessage, ServerResponse } from "node:http";
import {
	generateOAuthUrl,
	type OAuthConfig,
} from "@minesa-org/mini-interaction";

/**
 * OAuth configuration for Discord.
 */
const oauthConfig: OAuthConfig = {
	appId: process.env.DISCORD_APPLICATION_ID!,
	appSecret: process.env.DISCORD_CLIENT_SECRET!,
	redirectUri: process.env.DISCORD_REDIRECT_URI!,
};

/**
 * API endpoint to generate OAuth URL.
 * This keeps the client secret secure on the server side.
 */
export default async function handler(
	req: IncomingMessage,
	res: ServerResponse,
) {
	// Only allow GET requests
	if (req.method !== "GET") {
		res.writeHead(405, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Method not allowed" }));
		return;
	}

	try {
		// Generate OAuth URL with required scopes
		const { url, state } = generateOAuthUrl(oauthConfig, [
			"identify",
			"role_connections.write",
		]);

		// Return the URL as JSON
		res.writeHead(200, {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*", // Allow CORS for the frontend
		});
		res.end(
			JSON.stringify({
				url,
				state,
			}),
		);
	} catch (error) {
		console.error("Error generating OAuth URL:", error);
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Failed to generate OAuth URL" }));
	}
}

