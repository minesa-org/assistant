import {
	CommandBuilder,
	CommandContext,
	CommandInteraction,
	IntegrationType,
	type MiniInteractionCommand,
} from "@minesa-org/mini-interaction";
import { setUserAssistantStatus } from "../utils/database.js";

/**
 * Command to set a user's assistant status in the database.
 * This updates the local database value that will be synced to Discord
 * when the user connects their linked role via OAuth.
 */
const set_assistant: MiniInteractionCommand = {
	data: new CommandBuilder()
		.setName("set-assistant")
		.setDescription("Set a user's assistant status")
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
				.setDescription("The user to set assistant status for")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("status")
				.setDescription("Set assistant status")
				.setRequired(true)
				.addChoice("True", "true")
				.addChoice("False", "false"),
		)
		.toJSON(),

	handler: async (interaction: CommandInteraction) => {
		const { options } = interaction;

		// Get the user and status from options
		const userOption = options.getUser("user");
		const statusString = options.getString("status");

		if (!userOption || !statusString) {
			return interaction.reply({
				content: "❌ Invalid options provided.",
				flags: 64, // Ephemeral
			});
		}

		const status = statusString === "true";
		const userId = userOption.user.id;
		const username = userOption.user.username;

		try {
			// Update the database
			const success = await setUserAssistantStatus(userId, status);

			if (success) {
				return interaction.reply({
					content:
						`✅ Successfully set **${username}**'s assistant status to **${
							status ? "true" : "false"
						}**.\n\n` +
						`ℹ️ The user needs to connect their linked role via OAuth for this to take effect in Discord.\n` +
						`They can do this by using the \`/link-role\` command.`,
					flags: 64, // Ephemeral
				});
			} else {
				return interaction.reply({
					content:
						"❌ Failed to update the database. Please try again.",
					flags: 64, // Ephemeral
				});
			}
		} catch (error) {
			console.error("Error setting assistant status:", error);
			return interaction.reply({
				content: "❌ An error occurred while updating the database.",
				flags: 64, // Ephemeral
			});
		}
	},
};

export default set_assistant;
