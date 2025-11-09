import type { IncomingMessage, ServerResponse } from "node:http";
import {
	getOAuthTokens,
	getDiscordUser,
	type OAuthConfig,
} from "@minesa-org/mini-interaction";
import { updateDiscordMetadata } from "../src/utils/database.js";

/**
 * OAuth configuration for Discord.
 */
const oauthConfig: OAuthConfig = {
	appId: process.env.DISCORD_APPLICATION_ID!,
	appSecret: process.env.DISCORD_CLIENT_SECRET!,
	redirectUri: process.env.DISCORD_REDIRECT_URI!,
};

/**
 * Handles the OAuth callback from Discord.
 * Exchanges the code for tokens and updates user metadata.
 */
export default async function handler(
	req: IncomingMessage,
	res: ServerResponse,
) {
	try {
		// Parse the URL to get query parameters
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		// Handle OAuth errors
		if (error) {
			res.writeHead(400, { "Content-Type": "text/html" });
			res.end(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>OAuth Error</title>
					<style>
						body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
						.error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
					</style>
				</head>
				<body>
					<h1>OAuth Error</h1>
					<div class="error">
						<p>Authorization failed: ${error}</p>
						<p>Please try again.</p>
					</div>
				</body>
				</html>
			`);
			return;
		}

		// Validate code parameter
		if (!code) {
			res.writeHead(400, { "Content-Type": "text/html" });
			res.end(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Missing Code</title>
					<style>
						body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
						.error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
					</style>
				</head>
				<body>
					<h1>Missing Authorization Code</h1>
					<div class="error">
						<p>No authorization code was provided.</p>
					</div>
				</body>
				</html>
			`);
			return;
		}

		// Exchange code for tokens
		const tokens = await getOAuthTokens(code, oauthConfig);

		// Get user information
		const user = await getDiscordUser(tokens.access_token);

		// Update Discord metadata with current database values
		await updateDiscordMetadata(user.id, tokens.access_token);

		// Success response
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Linked Role Connected</title>
				<style>
					body { 
						font-family: Arial, sans-serif; 
						max-width: 600px; 
						margin: 50px auto; 
						padding: 20px;
						text-align: center;
					}
					.success { 
						color: #2e7d32; 
						background: #e8f5e9; 
						padding: 20px; 
						border-radius: 10px;
						margin: 20px 0;
					}
					.info {
						background: #e3f2fd;
						padding: 15px;
						border-radius: 5px;
						margin: 20px 0;
					}
					h1 { color: #5865f2; }
					.user-info {
						margin: 10px 0;
						font-size: 18px;
					}
				</style>
			</head>
			<body>
				<h1>✅ Successfully Connected!</h1>
				<div class="success">
					<p><strong>Your Discord account has been linked!</strong></p>
					<div class="user-info">
						<p>👤 ${user.username}#${user.discriminator}</p>
					</div>
				</div>
				<div class="info">
					<p>Your linked role metadata has been updated.</p>
					<p>You can now close this window and return to Discord.</p>
				</div>
			</body>
			</html>
		`);
	} catch (err) {
		console.error("OAuth callback error:", err);

		res.writeHead(500, { "Content-Type": "text/html" });
		res.end(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Server Error</title>
				<style>
					body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
					.error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
				</style>
			</head>
			<body>
				<h1>Server Error</h1>
				<div class="error">
					<p>An error occurred while processing your request.</p>
					<p>Please try again later.</p>
				</div>
			</body>
			</html>
		`);
	}
}
