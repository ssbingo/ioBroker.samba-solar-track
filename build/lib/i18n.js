"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var i18n_exports = {};
__export(i18n_exports, {
  LANGUAGES: () => LANGUAGES,
  TRANSLATIONS: () => TRANSLATIONS,
  fullName: () => fullName,
  joinNames: () => joinNames
});
module.exports = __toCommonJS(i18n_exports);
var import_name_translations = require("./name-translations");
const LANGUAGES = ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"];
const TRANSLATIONS = import_name_translations.NAME_TRANSLATIONS;
function fullName(name) {
  var _a;
  const other = TRANSLATIONS[name.en];
  const result = { en: name.en, de: name.de };
  for (const language of LANGUAGES) {
    if (language !== "en" && language !== "de") {
      result[language] = (_a = other == null ? void 0 : other[language]) != null ? _a : name.en;
    }
  }
  return result;
}
function joinNames(first, second) {
  const result = {};
  for (const language of LANGUAGES) {
    const tail = typeof second === "string" ? second : second[language];
    result[language] = first ? `${first[language]} ${tail}` : tail;
  }
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LANGUAGES,
  TRANSLATIONS,
  fullName,
  joinNames
});
//# sourceMappingURL=i18n.js.map
