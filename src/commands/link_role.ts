import {
	CommandBuilder,
	CommandContext,
	CommandInteraction,
	IntegrationType,
	type MiniInteractionCommand,
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
 * Command to generate an OAuth link for users to connect their linked role.
 */
const link_role: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("link-role")
		.setDescription("Get a link to connect your Discord linked role")
		.setContexts([
			CommandContext.Guild,
			CommandContext.Bot,
			CommandContext.DM,
		])
		.setIntegrationTypes([
			IntegrationType.GuildInstall,
			IntegrationType.UserInstall,
		])
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		try {
			// Generate OAuth URL with role_connections.write scope
			const { url } = generateOAuthUrl(oauthConfig, [
				"identify",
				"role_connections.write",
			]);

			return interaction.reply({
				content:
					`🔗 **Connect Your Linked Role**\n\n` +
					`Click the link below to authorize this app and update your linked role metadata:\n\n` +
					`${url}\n\n` +
					`ℹ️ This will allow the app to update your role connection based on your assistant status.\n` +
					`🔒 Your data is secure and only used for linked roles.`,
				flags: 64, // Ephemeral
			});
		} catch (error) {
			console.error("Error generating OAuth URL:", error);
			return interaction.reply({
				content:
					"❌ An error occurred while generating the authorization link.",
				flags: 64, // Ephemeral
			});
		}
	},
};

export default link_role;
