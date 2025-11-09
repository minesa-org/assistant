import {
	MiniInteraction,
	RoleConnectionMetadataTypes,
} from "@minesa-org/mini-interaction";

/**
 * Initialize the MiniInteraction client.
 * This will automatically load commands and components from the dist directory.
 */
const mini = new MiniInteraction({
	applicationId: process.env.DISCORD_APPLICATION_ID!,
	publicKey: process.env.DISCORD_APP_PUBLIC_KEY!,
});

/**
 * Register the linked role metadata with Discord.
 * This defines what metadata fields are available for linked roles.
 */
await mini.registerMetadata(process.env.DISCORD_BOT_TOKEN!, [
	{
		key: "is_assistant",
		name: "Is Assistant?",
		description: "Is the user an assistant?",
		type: RoleConnectionMetadataTypes.BooleanEqual,
	},
]);

/**
 * Export the Vercel handler for processing Discord interactions.
 */
export default mini.createVercelHandler();
