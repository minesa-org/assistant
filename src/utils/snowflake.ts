/**
 * Discord Snowflake utilities.
 *
 * A snowflake encodes its creation time: `(id >> 22) + Discord epoch`.
 *
 * @see {@link https://discord.com/developers/docs/reference#snowflakes}
 */

/** 2015-01-01T00:00:00.000Z, the first millisecond of Discord's epoch. */
export const DISCORD_EPOCH = 1420070400000n;

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/** Checks whether a value is a well-formed snowflake (17–20 digits). */
export function isValidSnowflake(value: unknown): value is string {
	return typeof value === "string" && SNOWFLAKE_REGEX.test(value);
}

/**
 * Extracts the creation timestamp (ms since Unix epoch) from a snowflake.
 *
 * @throws when the input is not a valid snowflake.
 */
export function snowflakeToTimestamp(id: string): number {
	assertSnowflake(id);
	return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
}

/** Convenience wrapper returning a `Date` for a snowflake's creation time. */
export function snowflakeToDate(id: string): Date {
	return new Date(snowflakeToTimestamp(id));
}

function assertSnowflake(id: string): void {
	if (!isValidSnowflake(id)) {
		throw new Error(
			`[MiniInteraction] "${id}" is not a valid snowflake (expected 17-20 digits).`,
		);
	}
}
