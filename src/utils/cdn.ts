/**
 * Discord CDN URL builders (discord.js `CDN` class equivalents) as pure functions.
 *
 * All helpers accept an optional `{ format?, size? }` options object; animated
 * hashes default to the GIF format.
 */

export type ImageSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;

export type ImageFormat =
	| "png"
	| "jpg"
	| "jpeg"
	| "webp"
	| "gif";

export type ImageOptions = {
	format?: ImageFormat;
	size?: ImageSize;
};

const CDN_BASE = "https://cdn.discordapp.com";
const MEDIA_BASE = "https://media.discordapp.net";

function buildUrl(
	base: string,
	path: string,
	hash: string,
	options?: ImageOptions,
): string {
	const isAnimated = hash.startsWith("a_");
	const format = options?.format ?? (isAnimated ? "gif" : "png");
	const params = new URLSearchParams();
	if (options?.size !== undefined) params.set("size", String(options.size));
	const query = params.size > 0 ? `?${params.toString()}` : "";

	return `${base}${path}/${hash}.${format}${query}`;
}

/** A user's avatar; pass the `avatar` hash from the user object. */
export function avatarURL(
	userId: string,
	avatarHash: string,
	options?: ImageOptions,
): string {
	return buildUrl(CDN_BASE, `/avatars/${userId}`, avatarHash, options);
}

/** The default avatar shown when a user has no custom avatar. */
export function defaultAvatarURL(index: number | string): string {
	const resolvedIndex =
		typeof index === "number"
			? Math.abs(index) % 6
			: Number((BigInt(index) >> 22n) % 6n);

	return `${CDN_BASE}/embed/avatars/${resolvedIndex}.png`;
}

/** A user's banner; requires the profile fetch to obtain the hash. */
export function userBannerURL(
	userId: string,
	bannerHash: string,
	options?: ImageOptions,
): string {
	return buildUrl(CDN_BASE, `/banners/${userId}`, bannerHash, options);
}

/** A guild's icon. */
export function guildIconURL(
	guildId: string,
	iconHash: string,
	options?: ImageOptions,
): string {
	return buildUrl(CDN_BASE, `/icons/${guildId}`, iconHash, options);
}

/** A guild's banner. */
export function guildBannerURL(
	guildId: string,
	bannerHash: string,
	options?: ImageOptions,
): string {
	return buildUrl(CDN_BASE, `/banners/${guildId}`, bannerHash, options);
}

/** A guild's splash image. */
export function guildSplashURL(
	guildId: string,
	splashHash: string,
	options?: ImageOptions,
): string {
	return buildUrl(CDN_BASE, `/splashes/${guildId}`, splashHash, options);
}

/** A custom emoji image. */
export function emojiURL(emojiId: string, animated = false, size?: ImageSize): string {
	const params = new URLSearchParams();
	if (size !== undefined) params.set("size", String(size));
	const query = params.size > 0 ? `?${params.toString()}` : "";

	return `${CDN_BASE}/emojis/${emojiId}.${animated ? "gif" : "png"}${query}`;
}

/** A sticker image (stickers always render as PNG or Lottie). */
export function stickerURL(stickerId: string): string {
	return `${CDN_BASE}/stickers/${stickerId}.png`;
}

/** Rebuilds a CDN media URL from a message attachment's fields. */
export function attachmentURL(
	channelId: string,
	fileId: string,
	filename: string,
): string {
	return `${MEDIA_BASE}/attachments/${channelId}/${fileId}/${encodeURIComponent(filename)}`;
}
