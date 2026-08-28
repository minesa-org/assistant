import { test } from "node:test";
import assert from "node:assert/strict";

import {
	bold,
	italic,
	underline,
	strikethrough,
	inlineCode,
	codeBlock,
	blockQuote,
	multilineBlockQuote,
	spoiler,
	subtext,
	heading,
	bulletList,
	numberedList,
	maskLink,
	timestamp,
	userMention,
	roleMention,
	channelMention,
	slashCommandMention,
	escapeMarkdown,
} from "./formatting.js";

test("text styles wrap content", () => {
	assert.equal(bold("hi"), "**hi**");
	assert.equal(italic("hi"), "*hi*");
	assert.equal(underline("hi"), "__hi__");
	assert.equal(strikethrough("hi"), "~~hi~~");
	assert.equal(spoiler("plot"), "||plot||");
	assert.equal(subtext("note"), "-# note");
});

test("code helpers", () => {
	assert.equal(inlineCode("x"), "`x`");
	assert.equal(codeBlock("let x = 1;"), "```\nlet x = 1;\n```");
	assert.equal(codeBlock("let x = 1;", "ts"), "```ts\nlet x = 1;\n```");
});

test("quotes and headings", () => {
	assert.equal(blockQuote("line1\nline2"), "> line1\n> line2");
	assert.equal(multilineBlockQuote("deep"), ">>> deep");
	assert.equal(heading("Big"), "# Big");
	assert.equal(heading("Big", 3), "### Big");
	// newlines are not allowed inside headings
	assert.equal(heading("two\nlines", 2), "## two lines");
});

test("lists join items", () => {
	assert.equal(bulletList(["a", "b"]), "- a\n- b");
	assert.equal(numberedList(["a", "b"]), "1. a\n2. b");
});

test("mentions and links", () => {
	assert.equal(maskLink("Site", "https://example.com"), "[Site](https://example.com)");
	assert.equal(userMention("111"), "<@111>");
	assert.equal(roleMention("222"), "<@&222>");
	assert.equal(channelMention("333"), "<#333>");
	assert.equal(slashCommandMention("ping", "444"), "</ping:444>");
});

test("timestamp converts to unix seconds with optional style", () => {
	assert.equal(timestamp(new Date(Date.UTC(2026, 0, 1))), "<t:1767225600>");
	assert.equal(timestamp(new Date(Date.UTC(2026, 0, 1)), "R"), "<t:1767225600:R>");
	assert.equal(timestamp(1767225600, "f"), "<t:1767225600:f>");
});

test("escapeMarkdown escapes all markdown characters by default", () => {
	const escaped = escapeMarkdown("*_~`|#>-\\");
	for (const char of ["*", "_", "~", "`", "|", "#", ">", "-", "\\"]) {
		assert.ok(escaped.includes(`\\${char}`), `missing escape for ${char}`);
	}
});

test("escapeMarkdown honours custom character set", () => {
	assert.equal(escapeMarkdown("a*b_c", { characters: ["*"] }), "a\\*b_c");
});
