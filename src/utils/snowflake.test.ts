import { test } from "node:test";
import assert from "node:assert/strict";

import {
	DISCORD_EPOCH,
	isValidSnowflake,
	snowflakeToDate,
	snowflakeToTimestamp,
} from "./snowflake.js";

test("validates snowflake shape", () => {
	assert.equal(isValidSnowflake("175994302537908224"), true);
	assert.equal(isValidSnowflake("123"), false);
	assert.equal(isValidSnowflake("nope"), false);
	assert.equal(isValidSnowflake(123 as unknown), false);
});

test("extracts the creation timestamp from a snowflake", () => {
	const id = "175994302537908224";
	const expected = Number((BigInt(id) >> 22n) + DISCORD_EPOCH);

	assert.equal(snowflakeToTimestamp(id), expected);
	assert.equal(snowflakeToDate(id).getTime(), expected);
});

test("throws on malformed input", () => {
	assert.throws(() => snowflakeToTimestamp("abc"), /not a valid snowflake/);
});

test("later ids always map to later timestamps", () => {
	const earlier = snowflakeToTimestamp("100000000000000000");
	const later = snowflakeToTimestamp("200000000000000000");
	assert.ok(later > earlier);
});
