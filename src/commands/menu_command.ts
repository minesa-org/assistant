import {
	CommandInteraction,
	MessageCommandBuilder,
	MiniInteractionCommand,
} from "@minesa-org/mini-interaction";

const menu_command: MiniInteractionCommand = {
	data: new MessageCommandBuilder().setName("Menu").toJSON(),

	handler: (interaction: CommandInteraction) => {
		return interaction.reply({ content: "Hey" });
	},
};

export default menu_command;
