import { CommandBuilder } from "@minesa-org/mini-interaction";
import type { ChatInputHandler } from "@minesa-org/mini-interaction";

/**
 * `/echo` — demonstrates the v0.6+ wrapped interaction option resolver.
 * Handlers receive typed interactions; `ctx` carries the reply lifecycle.
 */
export const echoCommand = {
	data: new CommandBuilder()
		.setName("echo")
		.setDescription("Echoes your text back")
		.addStringOption((option) =>
			option
				.setName("text")
				.setDescription("What should I say?")
				.setRequired(true),
		),

	handler: (async (interaction, ctx) => {
		const text = interaction.options.getString("text", true);

		return ctx.reply({
			content: `🔊 ${text}`,
		});
	}) satisfies ChatInputHandler,
};
