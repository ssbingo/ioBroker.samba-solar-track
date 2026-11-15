import { expect } from "chai";
import { LANGUAGES, TRANSLATIONS, fullName, joinNames } from "./i18n";
import { PARAM_TEXTS } from "./params";
import { NODES, STATES, elevationLabelStates, type Name } from "./states";

/**
 * Names that are the same word in English and in another language. "West" is the cardinal
 * direction in German as well (the display writes WEST); it is the one defensible exception.
 */
const SAME_WORD: Record<string, string[]> = { West: ["de"] };

/** Every name the adapter writes into an object */
const NAMES: Name[] = [
    ...NODES.map(node => node.name),
    ...STATES.map(def => def.name),
    ...elevationLabelStates(-1).map(def => def.name),
    ...PARAM_TEXTS,
];

describe("i18n => names of the objects", () => {
    it("have a translation into every language of ioBroker", () => {
        for (const name of NAMES) {
            expect(TRANSLATIONS[name.en], `no translation for "${name.en}"`).to.be.an("object");
            const full = fullName(name);
            expect(Object.keys(full).sort(), name.en).to.deep.equal([...LANGUAGES].sort());
            for (const language of LANGUAGES) {
                expect(full[language], `${language} of "${name.en}"`).to.be.a("string").and.not.equal("");
            }
        }
    });

    it("never just repeat the English text in another language", () => {
        for (const name of NAMES) {
            const full = fullName(name);
            for (const language of LANGUAGES.filter(l => l !== "en" && !SAME_WORD[name.en]?.includes(l))) {
                expect(full[language], `${language} of "${name.en}"`).to.not.equal(name.en);
            }
        }
    });

    it("keep no translation that no object uses any more", () => {
        const used = new Set(NAMES.map(name => name.en));
        for (const english of Object.keys(TRANSLATIONS)) {
            expect(used.has(english), `unused translation "${english}"`).to.equal(true);
        }
    });

    it("join two parts in every language", () => {
        const joined = joinNames(fullName({ en: "Sun sensor", de: "Sonnensensor" }), "x1");
        expect(joined.en).to.equal("Sun sensor x1");
        expect(joined.de).to.equal("Sonnensensor x1");
        expect(joinNames(undefined, "key").pl).to.equal("key");
    });
});
