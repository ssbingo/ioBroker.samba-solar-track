import { expect } from "chai";
import { EventDetector } from "./events";
import { LANGUAGES, NOTIFICATIONS, messagingOptions, supportedLanguage, translate } from "./notifications";

/**
 * The placeholders of a text, sorted.
 *
 * @param text the text
 */
function placeholders(text: string): string[] {
    return [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
}

describe("notifications => texts", () => {
    it("exist in all 11 languages of ioBroker", () => {
        expect(LANGUAGES).to.have.length(11);
        for (const [key, texts] of Object.entries(NOTIFICATIONS)) {
            for (const language of LANGUAGES) {
                expect(texts[language], `${key} in ${language}`).to.be.a("string").and.not.equal("");
            }
        }
    });

    it("use the same placeholders in every language and always name the device", () => {
        for (const [key, texts] of Object.entries(NOTIFICATIONS)) {
            const expected = placeholders(texts.en);
            expect(expected, key).to.include("name");
            for (const language of LANGUAGES) {
                expect(placeholders(texts[language]), `${key} in ${language}`).to.deep.equal(expected);
            }
        }
    });

    it("exist for every event the detector can report", () => {
        const detector = new EventDetector();
        const ok = {
            storm: { active: false },
            fault: { io: false, motor: false },
            wind: { ok: true },
            sun: { ok: true },
        };
        const bad = {
            storm: { active: true },
            fault: { io: true, motor: true },
            wind: { ok: false },
            sun: { ok: false },
        };
        detector.update(ok);
        const keys = [...detector.update(bad), ...detector.update(ok)].map(event => event.key);
        expect(keys).to.have.length(9);
        for (const key of [...keys, "connectionLost", "connectionRestored", "deviceRestarted"]) {
            expect(NOTIFICATIONS, key).to.have.property(key);
        }
    });
});

describe("notifications => translate", () => {
    it("fills in the values", () => {
        expect(translate("stormStarted", "de", { name: "Tracker Garten", gust: "44.0", threshold: "40.0" })).to.equal(
            "Tracker Garten: Sturmschutz aktiv. Böe 44.0 km/h, Schwelle 40.0 km/h. Das Modul fährt in die Flachstellung.",
        );
        expect(translate("connectionLost", "en", { name: "Tracker", minutes: 5 })).to.contain("for 5 minute(s)");
    });

    it("uses English for an unknown or missing language", () => {
        expect(translate("stormEnded", "xx", { name: "T" })).to.equal("T: storm protection ended.");
        expect(translate("stormEnded", undefined, { name: "T" })).to.equal("T: storm protection ended.");
        expect(supportedLanguage("zh-cn")).to.equal("zh-cn");
        expect(supportedLanguage("tlh")).to.equal("en");
    });

    it("leaves a placeholder without a value as it is and does not fail for an unknown key", () => {
        expect(translate("deviceRestarted", "en", { name: "T" })).to.equal(
            "T: the device has restarted (reason: {reason}).",
        );
        expect(translate("somethingNew", "en", { name: "T" })).to.equal('somethingNew {"name":"T"}');
    });
});

describe("notifications => messagingOptions", () => {
    it("lists the instances of messaging adapters, sorted, and nothing else", () => {
        expect(
            messagingOptions([
                "system.adapter.telegram.1",
                "system.adapter.admin.0",
                "system.adapter.pushover.0",
                "system.adapter.telegram.0",
                "system.adapter.samba-solar-track.0",
                "system.adapter.telegram.0.alive",
            ]),
        ).to.deep.equal([
            { value: "pushover.0", label: "pushover.0" },
            { value: "telegram.0", label: "telegram.0" },
            { value: "telegram.1", label: "telegram.1" },
        ]);
        expect(messagingOptions([])).to.deep.equal([]);
    });
});
