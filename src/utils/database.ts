import {
	MiniDatabase,
	MiniDatabaseBuilder,
	MiniDataBuilder,
} from "@minesa-org/mini-interaction";

/**
 * User data schema for the database.
 * Stores user metadata for linked roles.
 */
const userSchema = new MiniDataBuilder()
	.addField("userId", "string", { required: true })
	.addField("is_assistant", "boolean", { default: false })
	.addField("lastUpdated", "number", { default: Date.now() });

/**
 * Database configuration based on environment variables.
 */
const dbConfig = new MiniDatabaseBuilder()
	.setType((process.env.DATABASE_TYPE as "json" | "mongodb") || "json")
	.setDataPath(process.env.DATABASE_PATH || "./data")
	.setMongoUri(process.env.DATABASE_MONGO_URI || "")
	.setDbName(process.env.MONGO_DB_NAME || "assistant")
	.setCollectionName(process.env.MONGO_COLLECTION_NAME || "users")
	.build();

/**
 * Shared database instance for the application.
 */
export const db = new MiniDatabase(dbConfig, userSchema);

/**
 * Gets user data from the database.
 */
export async function getUserData(userId: string) {
	try {
		return await db.get(userId);
	} catch (error) {
		console.error("❌ Error getting user data:", error);
		console.error("Database config:", {
			type: process.env.DATABASE_TYPE || "json",
			path: process.env.DATABASE_PATH || "./data",
		});
		throw error;
	}
}

/**
 * Sets user's is_assistant status in the database.
 */
export async function setUserAssistantStatus(
	userId: string,
	isAssistant: boolean,
) {
	try {
		// Always use set() to avoid MongoDB createdAt/updatedAt conflict
		// The package automatically handles timestamps
		return await db.set(userId, {
			userId,
			is_assistant: isAssistant,
			lastUpdated: Date.now(),
		});
	} catch (error) {
		console.error("❌ Error setting user assistant status:", error);
		console.error("Database config:", {
			type: process.env.DATABASE_TYPE || "json",
			path: process.env.DATABASE_PATH || "./data",
		});
		throw error;
	}
}

/**
 * Updates user metadata for Discord linked roles.
 * This function pushes the metadata to Discord's API.
 */
export async function updateDiscordMetadata(
	userId: string,
	accessToken: string,
) {
	const userData = await getUserData(userId);
	const isAssistant = userData?.is_assistant || false;

	const metadata = {
		platform_name: "Assistant App",
		platform_username: userId,
		metadata: {
			is_assistant: isAssistant ? 1 : 0,
		},
	};

	const response = await fetch(
		`https://discord.com/api/v10/users/@me/applications/${process.env.DISCORD_APPLICATION_ID}/role-connection`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(metadata),
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to update Discord metadata: ${error}`);
	}

	return await response.json();
}
