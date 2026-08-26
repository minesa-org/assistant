import "dotenv/config";

import {
	DiscordRestClient,
	MiniInteraction,
	RoleConnectionMetadataTypes,
} from "@minesa-org/mini-interaction";

import { echoCommand } from "../src/commands/echo.js";
import { pingCommand } from "../src/commands/ping.js";

/**
 * Registers every command payload with Discord, then publishes the
 * linked-roles metadata. Run with `npm run register`.
 *
 * Set DISCORD_GUILD_ID to scope commands to one guild (updates instantly);
 * leave it unset for global registration (may take up to an hour).
 */
const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!applicationId || !botToken) {
	console.log(
		"⚠️ DISCORD_APPLICATION_ID / DISCORD_BOT_TOKEN not found. Skipping registration.",
	);
	process.exit(0);
}

const rest = new DiscordRestClient({ applicationId, token: botToken });
const guildId = process.env.DISCORD_GUILD_ID;
const route = guildId
	? `/applications/${applicationId}/guilds/${guildId}/commands`
	: `/applications/${applicationId}/commands`;

await rest.request(route, {
	method: "PUT",
	body: JSON.stringify([
		pingCommand.data.toJSON(),
		echoCommand.data.toJSON(),
	]),
});
console.log(
	`✅ Registered 2 command(s) on ${guildId ? `guild ${guildId}` : "global scope"}.`,
);

const mini = new MiniInteraction({ applicationId });
await mini.registerMetadata(botToken, [
	{
		key: "is_miniapp",
		name: "Is Mini App?",
		description: "Is the user an assistant?",
		type: RoleConnectionMetadataTypes.BooleanEqual,
	},
]);
console.log("✅ Linked-role metadata registered.");

console.log("Registration complete!");
