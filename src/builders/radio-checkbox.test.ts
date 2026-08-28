import { test } from "node:test";
import assert from "node:assert/strict";

import {
	RadioBuilder,
	CheckboxBuilder,
	CheckboxGroupBuilder,
} from "../builders/index.js";
import { ComponentType } from "discord-api-types/v10";

test("RadioBuilder emits the real RadioGroup component (type 21)", () => {
	const json = new RadioBuilder()
		.setCustomId("plan")
		.setRequired(true)
		.addOptions(
			{ label: "Basic", value: "basic" },
			{ label: "Pro", value: "pro", default: true },
		)
		.toJSON();

	assert.equal(json.type, ComponentType.RadioGroup);
	assert.equal(json.type, 21);
	assert.equal(json.required, true);
	assert.equal(json.options.length, 2);
});

test("RadioBuilder enforces the 2-10 option limit and single default", () => {
	assert.throws(
		() =>
			new RadioBuilder()
				.setCustomId("x")
				.addOptions({ label: "A", value: "a" })
				.toJSON(),
		/between 2 and 10/,
	);

	assert.throws(
		() =>
			new RadioBuilder()
				.setCustomId("x")
				.addOptions(
					{ label: "A", value: "a", default: true },
					{ label: "B", value: "b", default: true },
				)
				.toJSON(),
		/one default/,
	);
});

test("CheckboxBuilder builds the single checkbox component (type 23)", () => {
	const json = new CheckboxBuilder().setCustomId("tos").setDefault(true).toJSON();

	assert.equal(json.type, ComponentType.Checkbox);
	assert.equal(json.type, 23);
	assert.deepEqual(json, { type: 23, custom_id: "tos", default: true });
});

test("CheckboxGroupBuilder validates options and min/max values", () => {
	const json = new CheckboxGroupBuilder()
		.setCustomId("prefs")
		.setMinValues(1)
		.setMaxValues(2)
		.addOptions(
			{ label: "Email", value: "email" },
			{ label: "Push", value: "push" },
		)
		.toJSON();

	assert.equal(json.type, ComponentType.CheckboxGroup);
	assert.equal(json.type, 22);
	assert.equal(json.min_values, 1);

	assert.throws(
		() =>
			new CheckboxGroupBuilder()
				.setCustomId("bad")
				.addOptions({ label: "Only", value: "one" })
				.toJSON(),
		/between 2 and 10/,
	);

	assert.throws(
		() =>
			new CheckboxGroupBuilder()
				.setCustomId("bad")
				.setMinValues(3)
				.setMaxValues(2)
				.addOptions(
					{ label: "A", value: "a" },
					{ label: "B", value: "b" },
				)
				.toJSON(),
		/greater than max_values/,
	);
});
