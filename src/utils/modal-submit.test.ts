import { test } from "node:test";
import assert from "node:assert/strict";

import { createModalSubmitInteraction } from "./ModalSubmitInteraction.js";
import type { APIModalSubmitInteraction } from "discord-api-types/v10";

function modalWith(
	components: unknown[],
): ReturnType<typeof createModalSubmitInteraction> {
	const interaction = {
		type: 5,
		id: "1",
		token: "tok",
		application_id: "app",
		version: 1,
		data: { custom_id: "m", components },
	} as unknown as APIModalSubmitInteraction;

	return createModalSubmitInteraction(interaction);
}

test("text input values resolve through Label wrappers", () => {
	const wrapped = modalWith([
		{
			type: 18,
			label: "Name",
			component: { type: 4, custom_id: "name", value: "Ada" },
		},
	]);

	assert.equal(wrapped.getTextFieldValue("name"), "Ada");
});

test("select menu values resolve through Label wrappers", () => {
	const wrapped = modalWith([
		{
			type: 18,
			label: "Colour",
			component: {
				type: 3,
				custom_id: "colour",
				values: ["red", "blue"],
			},
		},
	]);

	assert.deepEqual(wrapped.getSelectMenuValues("colour"), ["red", "blue"]);
});

test("radio group submits expose a single optional value", () => {
	const wrapped = modalWith([
		{
			type: 18,
			label: "Plan",
			component: { type: 21, custom_id: "plan", value: "pro" },
		},
	]);

	assert.equal(wrapped.getRadioGroupValue("plan"), "pro");
	assert.equal(wrapped.getRadioGroupValue("missing"), undefined);
});

test("checkbox group and file upload submits expose value arrays", () => {
	const wrapped = modalWith([
		{
			type: 18,
			label: "Extras",
			component: { type: 22, custom_id: "extras", values: ["beta", "ai"] },
		},
		{
			type: 18,
			label: "Docs",
			component: { type: 19, custom_id: "docs", values: ["att-1"] },
		},
	]);

	assert.deepEqual(wrapped.getCheckboxGroupValues("extras"), ["beta", "ai"]);
	assert.equal(wrapped.getFileUploadValues("docs")[0], "att-1");
});

test("single checkbox exposes a boolean state", () => {
	const checked = modalWith([
		{
			type: 18,
			label: "ToS",
			component: { type: 23, custom_id: "tos", value: true },
		},
	]);
	assert.equal(checked.getCheckboxValue("tos"), true);

	const unchecked = modalWith([
		{ type: 23, custom_id: "tos" },
	]);
	assert.equal(unchecked.getCheckboxValue("tos"), undefined);
});
