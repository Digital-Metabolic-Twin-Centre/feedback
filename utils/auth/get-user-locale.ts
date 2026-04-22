/**
 * Get the user's locale from the browser or fallback to a default.
 */


import type { Locale } from "date-fns";
import { enIE } from "date-fns/locale/en-IE";
import { enGB } from "date-fns/locale/en-GB";
import { enUS } from "date-fns/locale/en-US";
import { fr } from "date-fns/locale/fr";
import { de } from "date-fns/locale/de";

const STATIC_LOCALES: Record<string, Locale> = {
    "en-IE": enIE,
    "en-GB": enGB,
    "en-US": enUS,
    fr,
    de,
};

export function getUserLocale(): string {
    if (typeof navigator !== "undefined") {
        return navigator.language || navigator.languages?.[0] || "en-IE";
    }
    return "en-IE";
}

export function getDateFnsLocale(userLocale?: string): Locale {
    const code = (userLocale ?? getUserLocale()).replace("_", "-");
    return STATIC_LOCALES[code] ?? enIE;
}

// Safe dynamic loader (tree-shakes and avoids the context error)
const LOADERS: Record<string, () => Promise<{ enIE: Locale } |
{ enGB: Locale } | { enUS: Locale } | { fr: Locale } | { de: Locale }>> = {
    "en-IE": () => import("date-fns/locale/en-IE"),
    "en-GB": () => import("date-fns/locale/en-GB"),
    "en-US": () => import("date-fns/locale/en-US"),
    fr: () => import("date-fns/locale/fr"),
    de: () => import("date-fns/locale/de"),
};

export async function loadLocale(userLocale: string): Promise<Locale> {
    const code = userLocale.replace("_", "-");
    const load = LOADERS[code];
    if (load) {
        const localeModule = await load();
        return Object.values(localeModule)[0];
    }
    return enIE; // fallback
}
