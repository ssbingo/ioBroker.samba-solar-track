/*
 * Languages of ioBroker and the translations of the object names.
 * Names are defined in English and German next to their object (states.ts, params.ts); the other
 * languages are looked up here by the English text. A unit test checks that every name has an
 * entry and that no language just repeats the English text.
 * Pure data and functions, no I/O.
 */
import { NAME_TRANSLATIONS } from "./name-translations";
import type { Name } from "./states";

/** Languages of ioBroker */
export const LANGUAGES = ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"] as const;

/** Language of ioBroker */
export type Language = (typeof LANGUAGES)[number];

/** A text in every language of ioBroker */
export type Translated = Record<Language, string>;

/** The languages that are not maintained next to the objects */
export type OtherLanguage = Exclude<Language, "en" | "de">;

/** Translations by the English text (name-translations.ts) */
export const TRANSLATIONS: Record<string, Record<OtherLanguage, string>> = NAME_TRANSLATIONS;

/**
 * A name in every language of ioBroker.
 *
 * @param name English and German
 * @returns the name; languages without a translation get the English text
 */
export function fullName(name: Name): Translated {
    const other = TRANSLATIONS[name.en];
    const result = { en: name.en, de: name.de } as Translated;
    for (const language of LANGUAGES) {
        if (language !== "en" && language !== "de") {
            result[language] = other?.[language] ?? name.en;
        }
    }
    return result;
}

/**
 * Puts two texts together, separated by a space, in every language.
 *
 * @param first first part, undefined = only the second part
 * @param second second part: a text in every language, or one text for all of them (a key)
 */
export function joinNames(first: Translated | undefined, second: Translated | string): Translated {
    const result = {} as Translated;
    for (const language of LANGUAGES) {
        const tail = typeof second === "string" ? second : second[language];
        result[language] = first ? `${first[language]} ${tail}` : tail;
    }
    return result;
}
