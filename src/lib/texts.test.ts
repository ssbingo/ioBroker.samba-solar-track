import { expect } from "chai";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LANGUAGES } from "./i18n";
import { NOTIFICATIONS } from "./notifications";

/** Root folder of the adapter */
const ROOT = join(__dirname, "..", "..");

/**
 * The one text that legitimately stays the same in every language: the product name.
 */
const PRODUCT_NAME = "Samba Solar Track";

/**
 * Reads the translation files of a folder (`<language>.json`).
 *
 * @param folder folder relative to the adapter
 * @returns language => key => text
 */
function readFolder(folder: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    for (const file of readdirSync(join(ROOT, folder)).filter(name => name.endsWith(".json"))) {
        result[file.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(ROOT, folder, file), "utf8"));
    }
    return result;
}

/**
 * Checks a set of translations: every language has every key and no other language repeats
 * the English text (except the product name).
 *
 * @param what name of the set for the messages
 * @param byLanguage language => key => text
 */
function checkSet(what: string, byLanguage: Record<string, Record<string, string>>): void {
    expect(Object.keys(byLanguage).sort(), `${what}: languages`).to.deep.equal([...LANGUAGES].sort());
    const en = byLanguage.en;
    for (const language of LANGUAGES) {
        expect(Object.keys(byLanguage[language]).sort(), `${what}: keys of ${language}`).to.deep.equal(
            Object.keys(en).sort(),
        );
        if (language === "en") {
            continue;
        }
        for (const [key, text] of Object.entries(en)) {
            const translated = byLanguage[language][key];
            expect(translated, `${what}: ${key} in ${language}`).to.be.a("string").and.not.equal("");
            if (text !== PRODUCT_NAME) {
                expect(translated, `${what}: ${key} in ${language} repeats the English text`).to.not.equal(text);
            }
        }
    }
}

/**
 * Turns objects keyed by language (io-package.json) into language => key => text.
 *
 * @param objects name => text in every language
 */
function byLanguage(objects: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    for (const [name, texts] of Object.entries(objects)) {
        for (const [language, text] of Object.entries(texts)) {
            result[language] = { ...result[language], [name]: text };
        }
    }
    return result;
}

describe("texts => translations in every language, no copy of the English text", () => {
    it("admin/i18n (settings page)", () => {
        checkSet("admin/i18n", readFolder("admin/i18n"));
    });

    it("io-package.json (title, description, news)", () => {
        const common = JSON.parse(readFileSync(join(ROOT, "io-package.json"), "utf8")).common;
        const news: Record<string, Record<string, string>> = {};
        for (const [version, texts] of Object.entries(common.news as Record<string, Record<string, string>>)) {
            news[`news ${version}`] = texts;
        }
        checkSet("io-package.json", byLanguage({ titleLang: common.titleLang, desc: common.desc, ...news }));
    });

    it("notifications", () => {
        checkSet("notifications", byLanguage(NOTIFICATIONS));
    });

    it("vis-2 widgets (src-widgets/src/i18n)", () => {
        checkSet("src-widgets/src/i18n", readFolder("src-widgets/src/i18n"));
    });
});
