import { test } from "node:test";
import assert from "node:assert/strict";

import {
	createLocalizationMap,
	mergeLocalizationMaps,
	resolveLocalization,
} from "./localization.js";

test("createLocalizationMap produces a plain map", () => {
	const map = createLocalizationMap({
		"en-US": "Balance",
		tr: "Bakiye",
	});

	assert.deepEqual(map, { "en-US": "Balance", tr: "Bakiye" });
});

test("resolveLocalization falls back exact → base language → default", () => {
	const map = createLocalizationMap({
		"en-US": "Balance",
		tr: "Bakiye",
	});

	assert.equal(resolveLocalization(map, "en-US", "?"), "Balance");
	assert.equal(resolveLocalization(map, "tr-TR", "?"), "Bakiye"); // base-language match
	assert.equal(resolveLocalization(map, "fr-FR", "?"), "?"); // default
	assert.equal(resolveLocalization(undefined, "en-US", "?"), "?");
});

test("mergeLocalizationMaps lets later maps win", () => {
	const merged = mergeLocalizationMaps(
		createLocalizationMap({ "en-US": "A", de: "A-de" }),
		createLocalizationMap({ de: "B-de" }),
	);

	assert.equal(merged["en-US"], "A");
	assert.equal(merged.de, "B-de");
});
