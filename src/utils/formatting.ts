/**
 * Discord markdown / text formatting helpers.
 *
 * Every helper is a pure string-to-string function so they compose naturally:
 *
 * ```ts
 * import { bold, italic, heading, userMention } from "@minesa-org/mini-interaction";
 *
 * const text = heading(`Welcome ${userMention(userId)}!`, 2) + "\n" + italic(bold("Enjoy your stay."));
 * ```
 */

/** Renders text in **bold**. */
export function bold(text: string): string {
	return `**${text}**`;
}

/** Renders text in *italic*. */
export function italic(text: string): string {
	return `*${text}*`;
}

/** Renders text as __underline__. */
export function underline(text: string): string {
	return `__${text}__`;
}

/** Renders text as ~~strikethrough~~. */
export function strikethrough(text: string): string {
	return `~~${text}~~`;
}

/** Renders inline code. */
export function inlineCode(text: string): string {
	return `\`${text}\``;
}

/**
 * Renders a fenced code block, optionally with a syntax-highlighting language.
 *
 * @param code - The code content (should not contain backtick fences).
 * @param language - Optional language identifier, e.g. `"ts"`.
 */
export function codeBlock(code: string, language?: string): string {
	return `\`\`\`${language ?? ""}\n${code}\n\`\`\``;
}

/** Renders a single-line (> ) block quote. Multi-line input is quoted per line. */
export function blockQuote(text: string): string {
	return text
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n");
}

/** Renders a multi-line (>>> ) block quote. */
export function multilineBlockQuote(text: string): string {
	return `>>> ${text}`;
}

/** Renders text as a ||spoiler||. */
export function spoiler(text: string): string {
	return `||${text}||`;
}

/** Renders small, muted subtext (-# text). */
export function subtext(text: string): string {
	return `-# ${text}`;
}

/**
 * Renders a markdown heading (# / ## / ###).
 *
 * @param text - The heading content (newlines are not allowed in headings).
 * @param level - Heading level 1-3; defaults to 1.
 */
export function heading(text: string, level: 1 | 2 | 3 = 1): string {
	const hashes = "#".repeat(Math.min(Math.max(level, 1), 3));
	return `${hashes} ${text.replace(/\n/g, " ")}`;
}

/** Renders items as a bulleted list. */
export function bulletList(items: readonly string[]): string {
	return items.map((item) => `- ${item}`).join("\n");
}

/** Renders items as a numbered list. */
export function numberedList(items: readonly string[]): string {
	return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

/** Renders masked links: [label](url). Only works inside embeds and normal messages. */
export function maskLink(label: string, url: string): string {
	return `[${label}](${url})`;
}

/** Timestamp styles supported by Discord's dynamic timestamps. */
export type DiscordTimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

/**
 * Renders a dynamic timestamp (<t:unix:style>).
 *
 * @param time - A Date, an ISO/parseable date string, or a **unix-seconds** number
 *   (matching Discord's own format — not milliseconds).
 * @param style - Optional display style; `"R"` shows relative time ("in 3 minutes").
 */
export function timestamp(
	time: Date | number | string,
	style?: DiscordTimestampStyle,
): string {
	let seconds: number;
	if (time instanceof Date) {
		seconds = Math.floor(time.getTime() / 1000);
	} else if (typeof time === "number") {
		seconds = Math.floor(time);
	} else {
		seconds = Math.floor(new Date(time).getTime() / 1000);
	}

	return style ? `<t:${seconds}:${style}>` : `<t:${seconds}>`;
}

/** Mentions a user by id (<@id>). */
export function userMention(userId: string): string {
	return `<@${userId}>`;
}

/** Mentions a role by id (<@&id>). */
export function roleMention(roleId: string): string {
	return `<@&${roleId}>`;
}

/** Mentions a channel by id (<#id>). */
export function channelMention(channelId: string): string {
	return `<#${channelId}>`;
}

/** Links a slash command by its full name (e.g. `"ping"` or `"config set key"`) and id. */
export function slashCommandMention(commandName: string, commandId: string): string {
	return `</${commandName}:${commandId}>`;
}

const ESCAPABLE = ["\\", "*", "_", "~", "`", "|", "#", ">", "-"] as const;

/**
 * Escapes Discord markdown characters so the text renders literally.
 *
 * @param text - The raw text to escape.
 * @param options.characters - Restrict escaping to these specific characters.
 */
export function escapeMarkdown(
	text: string,
	options?: { characters?: readonly string[] },
): string {
	const chars = options?.characters ?? ESCAPABLE;
	const unique = [...new Set(chars)];
	return text.replace(
		new RegExp(`[${unique.map(escapeRegExp).join("")}]`, "g"),
		(match) => `\\${match}`,
	);
}

function escapeRegExp(character: string): string {
	return character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
