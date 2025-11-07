import { MiniInteraction } from "@minesa-org/mini-interaction";

const mini = new MiniInteraction({
	applicationId: process.env.DISCORD_APPLICATION_ID!,
	publicKey: process.env.DISCORD_APP_PUBLIC_KEY!,
	commandsDirectory: "dist/commands",
	componentsDirectory: "dist/components",
});

export default mini.createVercelHandler();
