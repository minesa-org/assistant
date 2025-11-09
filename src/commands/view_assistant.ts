import {
	CommandBuilder,
	CommandContext,
	CommandInteraction,
	IntegrationType,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { getUserData } from "../utils/database.js";

/**
 * Command to view a user's assistant status from the database.
 */
const view_assistant: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("view-assistant")
		.setDescription("View a user's assistant status")
		.setContexts([
			CommandContext.Guild,
			CommandContext.Bot,
			CommandContext.DM,
		])
		.setIntegrationTypes([
			IntegrationType.GuildInstall,
			IntegrationType.UserInstall,
		])
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription(
					"The user to check (leave empty to check yourself)",
				)
				.setRequired(false),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const { options, user: interactionUser } = interaction;

		// Get the user from options, or default to the interaction user
		const targetUserOption = options.getUser("user");
		const targetUserId = targetUserOption
			? targetUserOption.user.id
			: interactionUser?.id;
		const targetUsername = targetUserOption
			? targetUserOption.user.username
			: interactionUser?.username;

		if (!targetUserId || !targetUsername) {
			return interaction.reply({
				content: "❌ Could not determine the user to check.",
				flags: 64, // Ephemeral
			});
		}

		try {
			// Get user data from database
			const userData = await getUserData(targetUserId);

			if (!userData) {
				return interaction.reply({
					content:
						`ℹ️ **${targetUsername}** has no data in the database yet.\n\n` +
						`Default assistant status: **false**`,
					flags: 64, // Ephemeral
				});
			}

			const isAssistant = userData.is_assistant || false;
			const updatedAt = userData.lastUpdated
				? new Date(userData.lastUpdated as number).toLocaleString()
				: "Unknown";

			return interaction.reply({
				content:
					`📊 **Assistant Status for ${targetUsername}**\n\n` +
					`✨ Is Assistant: **${
						isAssistant ? "Yes ✅" : "No ❌"
					}**\n` +
					`🕒 Last Updated: ${updatedAt}\n\n` +
					`ℹ️ This value is used for Discord linked roles.`,
				flags: 64, // Ephemeral
			});
		} catch (error) {
			console.error("Error viewing assistant status:", error);
			return interaction.reply({
				content:
					"❌ An error occurred while fetching data from the database.",
				flags: 64, // Ephemeral
			});
		}
	},
};

export default view_assistant;
