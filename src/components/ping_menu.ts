import type { ComponentHandler } from "@minesa-org/mini-interaction";

/** `ping_menu` — replies with the values chosen in the message select menu. */
export const pingMenu = {
	customId: "ping_menu",

	handler: (async (interaction, ctx) => {
		const value = interaction.getStringValues().join(", ");

		return ctx.reply({
			content: `Value(s) of select menu you selected: ${value}`,
		});
	}) satisfies ComponentHandler,
};
