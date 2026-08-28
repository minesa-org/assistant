import type { Locale } from "discord-api-types/v10";

import type { DiscordLocale, LocalizationMap } from "../types/RoleConnectionMetadata.js";

/** Typed alias so consumers can build localisation maps against real locales. */
export type { DiscordLocale, LocalizationMap };

/**
 * Creates a `LocalizationMap` with full key typing against Discord's locales.
 *
 * ```ts
 * const name = createLocalizationMap({
 *   "en-US": "Balance",
 *   tr: "Bakiye",
 *   de: "Guthaben",
 * });
 * ```
 */
export function createLocalizationMap(
	entries: Partial<Record<Locale, string>>,
): LocalizationMap {
	return { ...entries };
}

/** Shallowly merges several maps; later entries win. */
export function mergeLocalizationMaps(
	...maps: Array<LocalizationMap | undefined>
): LocalizationMap {
	return Object.assign({}, ...maps.filter(Boolean));
}

const BASE_LOCALE = (locale: string): string => locale.split("-")[0];

/**
 * Resolves the best string for a locale using a fallback chain:
 * exact match (`pt-BR`) → base language (`pt`) → provided default.
 *
 * Useful when rendering user-facing content from your own localisation data.
 */
export function resolveLocalization(
	map: LocalizationMap | undefined,
	locale: string,
	fallback: string,
): string {
	if (!map) return fallback;

	const exact = map[locale as DiscordLocale];
	if (exact !== undefined) return exact;

	const base = BASE_LOCALE(locale);
	for (const [key, value] of Object.entries(map)) {
		if (value !== undefined && BASE_LOCALE(key) === base) return value;
	}

	return fallback;
}
