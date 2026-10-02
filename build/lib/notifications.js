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
var notifications_exports = {};
__export(notifications_exports, {
  LANGUAGES: () => LANGUAGES,
  MESSAGING_ADAPTERS: () => MESSAGING_ADAPTERS,
  NOTIFICATIONS: () => NOTIFICATIONS,
  messagingOptions: () => messagingOptions,
  supportedLanguage: () => supportedLanguage,
  translate: () => translate
});
module.exports = __toCommonJS(notifications_exports);
const LANGUAGES = ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"];
const NOTIFICATIONS = {
  stormStarted: {
    en: "{name}: storm protection active. Gust {gust} km/h, threshold {threshold} km/h. The module drives to the flat position.",
    de: "{name}: Sturmschutz aktiv. B\xF6e {gust} km/h, Schwelle {threshold} km/h. Das Modul f\xE4hrt in die Flachstellung.",
    ru: "{name}: \u0437\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0448\u0442\u043E\u0440\u043C\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u0430. \u041F\u043E\u0440\u044B\u0432 {gust} \u043A\u043C/\u0447, \u043F\u043E\u0440\u043E\u0433 {threshold} \u043A\u043C/\u0447. \u041C\u043E\u0434\u0443\u043B\u044C \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u0442 \u0432 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435.",
    pt: "{name}: prote\xE7\xE3o contra tempestades ativa. Rajada {gust} km/h, limite {threshold} km/h. O m\xF3dulo desloca-se para a posi\xE7\xE3o horizontal.",
    nl: "{name}: stormbeveiliging actief. Windstoot {gust} km/u, drempel {threshold} km/u. Het paneel rijdt naar de vlakke stand.",
    fr: "{name} : protection contre les temp\xEAtes active. Rafale {gust} km/h, seuil {threshold} km/h. Le module se met \xE0 plat.",
    it: "{name}: protezione dalle tempeste attiva. Raffica {gust} km/h, soglia {threshold} km/h. Il modulo si porta in posizione orizzontale.",
    es: "{name}: protecci\xF3n contra tormentas activa. Racha {gust} km/h, umbral {threshold} km/h. El m\xF3dulo se desplaza a la posici\xF3n horizontal.",
    pl: "{name}: ochrona przed burz\u0105 aktywna. Poryw {gust} km/h, pr\xF3g {threshold} km/h. Modu\u0142 ustawia si\u0119 w pozycji poziomej.",
    uk: "{name}: \u0437\u0430\u0445\u0438\u0441\u0442 \u0432\u0456\u0434 \u0448\u0442\u043E\u0440\u043C\u0443 \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0439. \u041F\u043E\u0440\u0438\u0432 {gust} \u043A\u043C/\u0433\u043E\u0434, \u043F\u043E\u0440\u0456\u0433 {threshold} \u043A\u043C/\u0433\u043E\u0434. \u041C\u043E\u0434\u0443\u043B\u044C \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u0442\u044C \u0443 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u043D\u044F.",
    "zh-cn": "{name}\uFF1A\u98CE\u66B4\u4FDD\u62A4\u5DF2\u542F\u52A8\u3002\u9635\u98CE {gust} km/h\uFF0C\u9608\u503C {threshold} km/h\u3002\u7EC4\u4EF6\u6B63\u5728\u8F6C\u5230\u6C34\u5E73\u4F4D\u7F6E\u3002"
  },
  stormEnded: {
    en: "{name}: storm protection ended.",
    de: "{name}: Sturmschutz beendet.",
    ru: "{name}: \u0437\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0448\u0442\u043E\u0440\u043C\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430.",
    pt: "{name}: prote\xE7\xE3o contra tempestades terminada.",
    nl: "{name}: stormbeveiliging be\xEBindigd.",
    fr: "{name} : protection contre les temp\xEAtes termin\xE9e.",
    it: "{name}: protezione dalle tempeste terminata.",
    es: "{name}: protecci\xF3n contra tormentas finalizada.",
    pl: "{name}: ochrona przed burz\u0105 zako\u0144czona.",
    uk: "{name}: \u0437\u0430\u0445\u0438\u0441\u0442 \u0432\u0456\u0434 \u0448\u0442\u043E\u0440\u043C\u0443 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E.",
    "zh-cn": "{name}\uFF1A\u98CE\u66B4\u4FDD\u62A4\u5DF2\u7ED3\u675F\u3002"
  },
  faultMotor: {
    en: "{name}: fault. A drive ran longer than its maximum runtime ({axes}). Check the mechanics, then acknowledge the fault at the display or in ioBroker.",
    de: "{name}: St\xF6rung. Ein Antrieb lief l\xE4nger als seine H\xF6chstlaufzeit ({axes}). Mechanik pr\xFCfen, dann die St\xF6rung am Display oder in ioBroker quittieren.",
    ru: "{name}: \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C. \u041F\u0440\u0438\u0432\u043E\u0434 \u0440\u0430\u0431\u043E\u0442\u0430\u043B \u0434\u043E\u043B\u044C\u0448\u0435 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 ({axes}). \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0443, \u0437\u0430\u0442\u0435\u043C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C \u043D\u0430 \u0434\u0438\u0441\u043F\u043B\u0435\u0435 \u0438\u043B\u0438 \u0432 ioBroker.",
    pt: "{name}: avaria. Um acionamento funcionou mais tempo do que o m\xE1ximo permitido ({axes}). Verifique a mec\xE2nica e confirme a avaria no ecr\xE3 ou no ioBroker.",
    nl: "{name}: storing. Een aandrijving liep langer dan de maximale looptijd ({axes}). Controleer de mechaniek en bevestig de storing op het display of in ioBroker.",
    fr: "{name} : d\xE9faut. Un entra\xEEnement a fonctionn\xE9 plus longtemps que sa dur\xE9e maximale ({axes}). V\xE9rifiez la m\xE9canique, puis acquittez le d\xE9faut \xE0 l'\xE9cran ou dans ioBroker.",
    it: "{name}: guasto. Un azionamento ha funzionato pi\xF9 a lungo del tempo massimo ({axes}). Controllare la meccanica, poi confermare il guasto sul display o in ioBroker.",
    es: "{name}: aver\xEDa. Un accionamiento funcion\xF3 m\xE1s tiempo que el m\xE1ximo permitido ({axes}). Compruebe la mec\xE1nica y confirme la aver\xEDa en la pantalla o en ioBroker.",
    pl: "{name}: usterka. Nap\u0119d pracowa\u0142 d\u0142u\u017Cej ni\u017C maksymalny czas pracy ({axes}). Sprawd\u017A mechanik\u0119, a nast\u0119pnie potwierd\u017A usterk\u0119 na wy\u015Bwietlaczu lub w ioBroker.",
    uk: "{name}: \u043D\u0435\u0441\u043F\u0440\u0430\u0432\u043D\u0456\u0441\u0442\u044C. \u041F\u0440\u0438\u0432\u0456\u0434 \u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0432 \u0434\u043E\u0432\u0448\u0435 \u0437\u0430 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0438\u0439 \u0447\u0430\u0441 ({axes}). \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u043C\u0435\u0445\u0430\u043D\u0456\u043A\u0443, \u043F\u043E\u0442\u0456\u043C \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u044C\u0442\u0435 \u043D\u0435\u0441\u043F\u0440\u0430\u0432\u043D\u0456\u0441\u0442\u044C \u043D\u0430 \u0434\u0438\u0441\u043F\u043B\u0435\u0457 \u0430\u0431\u043E \u0432 ioBroker.",
    "zh-cn": "{name}\uFF1A\u6545\u969C\u3002\u9A71\u52A8\u5668\u8FD0\u884C\u65F6\u95F4\u8D85\u8FC7\u6700\u957F\u8FD0\u884C\u65F6\u95F4\uFF08{axes}\uFF09\u3002\u8BF7\u68C0\u67E5\u673A\u68B0\u90E8\u5206\uFF0C\u7136\u540E\u5728\u663E\u793A\u5C4F\u6216 ioBroker \u4E2D\u786E\u8BA4\u6545\u969C\u3002"
  },
  faultIo: {
    en: "{name}: fault. The component of the switching outputs does not answer. All outputs are switched off.",
    de: "{name}: St\xF6rung. Der Baustein der Schaltausg\xE4nge antwortet nicht. Alle Ausg\xE4nge sind ausgeschaltet.",
    ru: "{name}: \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C. \u041C\u043E\u0434\u0443\u043B\u044C \u043A\u043E\u043C\u043C\u0443\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0445 \u0432\u044B\u0445\u043E\u0434\u043E\u0432 \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442. \u0412\u0441\u0435 \u0432\u044B\u0445\u043E\u0434\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B.",
    pt: "{name}: avaria. O componente das sa\xEDdas de comuta\xE7\xE3o n\xE3o responde. Todas as sa\xEDdas est\xE3o desligadas.",
    nl: "{name}: storing. De component van de schakeluitgangen antwoordt niet. Alle uitgangen zijn uitgeschakeld.",
    fr: "{name} : d\xE9faut. Le composant des sorties de commutation ne r\xE9pond pas. Toutes les sorties sont coup\xE9es.",
    it: "{name}: guasto. Il componente delle uscite di commutazione non risponde. Tutte le uscite sono disattivate.",
    es: "{name}: aver\xEDa. El componente de las salidas de conmutaci\xF3n no responde. Todas las salidas est\xE1n desconectadas.",
    pl: "{name}: usterka. Uk\u0142ad wyj\u015B\u0107 prze\u0142\u0105czaj\u0105cych nie odpowiada. Wszystkie wyj\u015Bcia s\u0105 wy\u0142\u0105czone.",
    uk: "{name}: \u043D\u0435\u0441\u043F\u0440\u0430\u0432\u043D\u0456\u0441\u0442\u044C. \u041C\u043E\u0434\u0443\u043B\u044C \u043A\u043E\u043C\u0443\u0442\u0430\u0446\u0456\u0439\u043D\u0438\u0445 \u0432\u0438\u0445\u043E\u0434\u0456\u0432 \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454. \u0423\u0441\u0456 \u0432\u0438\u0445\u043E\u0434\u0438 \u0432\u0438\u043C\u043A\u043D\u0435\u043D\u043E.",
    "zh-cn": "{name}\uFF1A\u6545\u969C\u3002\u5F00\u5173\u8F93\u51FA\u7EC4\u4EF6\u65E0\u54CD\u5E94\u3002\u6240\u6709\u8F93\u51FA\u5747\u5DF2\u5173\u95ED\u3002"
  },
  faultCleared: {
    en: "{name}: the fault is cleared.",
    de: "{name}: Die St\xF6rung ist behoben.",
    ru: "{name}: \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0430.",
    pt: "{name}: a avaria foi resolvida.",
    nl: "{name}: de storing is verholpen.",
    fr: "{name} : le d\xE9faut est supprim\xE9.",
    it: "{name}: il guasto \xE8 stato risolto.",
    es: "{name}: la aver\xEDa se ha resuelto.",
    pl: "{name}: usterka zosta\u0142a usuni\u0119ta.",
    uk: "{name}: \u043D\u0435\u0441\u043F\u0440\u0430\u0432\u043D\u0456\u0441\u0442\u044C \u0443\u0441\u0443\u043D\u0435\u043D\u043E.",
    "zh-cn": "{name}\uFF1A\u6545\u969C\u5DF2\u6392\u9664\u3002"
  },
  windLost: {
    en: "{name}: the wind sensor does not answer. Automatic mode drives the module flat and stays blocked until the sensor answers again.",
    de: "{name}: Der Windmesser antwortet nicht. Die Automatik f\xE4hrt das Modul flach und bleibt gesperrt, bis er wieder antwortet.",
    ru: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0432\u0435\u0442\u0440\u0430 \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442. \u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u043A\u0430 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442 \u043C\u043E\u0434\u0443\u043B\u044C \u0432 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439, \u043F\u043E\u043A\u0430 \u0434\u0430\u0442\u0447\u0438\u043A \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u0442.",
    pt: "{name}: o sensor de vento n\xE3o responde. O modo autom\xE1tico coloca o m\xF3dulo na horizontal e fica bloqueado at\xE9 o sensor voltar a responder.",
    nl: "{name}: de windmeter antwoordt niet. De automaat zet het paneel vlak en blijft geblokkeerd tot de windmeter weer antwoordt.",
    fr: "{name} : l'an\xE9mom\xE8tre ne r\xE9pond pas. Le mode automatique met le module \xE0 plat et reste bloqu\xE9 jusqu'\xE0 ce qu'il r\xE9ponde de nouveau.",
    it: "{name}: l'anemometro non risponde. La modalit\xE0 automatica porta il modulo in piano e resta bloccata finch\xE9 non risponde di nuovo.",
    es: "{name}: el anem\xF3metro no responde. El modo autom\xE1tico coloca el m\xF3dulo en horizontal y queda bloqueado hasta que vuelva a responder.",
    pl: "{name}: wiatromierz nie odpowiada. Automatyka ustawia modu\u0142 na p\u0142asko i pozostaje zablokowana, dop\xF3ki czujnik zn\xF3w nie odpowie.",
    uk: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0432\u0456\u0442\u0440\u0443 \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454. \u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u043A\u0430 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u043C\u043E\u0434\u0443\u043B\u044C \u0443 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u043D\u044F \u0456 \u0437\u0430\u043B\u0438\u0448\u0430\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u043E\u0432\u0430\u043D\u043E\u044E, \u0434\u043E\u043A\u0438 \u0434\u0430\u0442\u0447\u0438\u043A \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0441\u0442\u044C.",
    "zh-cn": "{name}\uFF1A\u98CE\u901F\u8BA1\u65E0\u54CD\u5E94\u3002\u81EA\u52A8\u6A21\u5F0F\u5C06\u7EC4\u4EF6\u653E\u5E73\u5E76\u4FDD\u6301\u9501\u5B9A\uFF0C\u76F4\u5230\u98CE\u901F\u8BA1\u6062\u590D\u54CD\u5E94\u3002"
  },
  windBack: {
    en: "{name}: the wind sensor answers again.",
    de: "{name}: Der Windmesser antwortet wieder.",
    ru: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0432\u0435\u0442\u0440\u0430 \u0441\u043D\u043E\u0432\u0430 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442.",
    pt: "{name}: o sensor de vento voltou a responder.",
    nl: "{name}: de windmeter antwoordt weer.",
    fr: "{name} : l'an\xE9mom\xE8tre r\xE9pond de nouveau.",
    it: "{name}: l'anemometro risponde di nuovo.",
    es: "{name}: el anem\xF3metro vuelve a responder.",
    pl: "{name}: wiatromierz zn\xF3w odpowiada.",
    uk: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0432\u0456\u0442\u0440\u0443 \u0437\u043D\u043E\u0432\u0443 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454.",
    "zh-cn": "{name}\uFF1A\u98CE\u901F\u8BA1\u5DF2\u6062\u590D\u54CD\u5E94\u3002"
  },
  sunLost: {
    en: "{name}: the sun sensor reports a fault. Tracking pauses.",
    de: "{name}: Der Sonnensensor meldet eine St\xF6rung. Die Nachf\xFChrung pausiert.",
    ru: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0441\u043E\u043B\u043D\u0446\u0430 \u0441\u043E\u043E\u0431\u0449\u0430\u0435\u0442 \u043E \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u0438. \u0421\u043B\u0435\u0436\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E.",
    pt: "{name}: o sensor solar comunica uma avaria. O seguimento est\xE1 em pausa.",
    nl: "{name}: de zonnesensor meldt een storing. Het volgen pauzeert.",
    fr: "{name} : le capteur solaire signale un d\xE9faut. Le suivi est en pause.",
    it: "{name}: il sensore solare segnala un guasto. L'inseguimento \xE8 in pausa.",
    es: "{name}: el sensor solar comunica una aver\xEDa. El seguimiento est\xE1 en pausa.",
    pl: "{name}: czujnik s\u0142o\u0144ca zg\u0142asza usterk\u0119. \u015Aledzenie jest wstrzymane.",
    uk: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0441\u043E\u043D\u0446\u044F \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u044F\u0454 \u043F\u0440\u043E \u043D\u0435\u0441\u043F\u0440\u0430\u0432\u043D\u0456\u0441\u0442\u044C. \u0421\u0442\u0435\u0436\u0435\u043D\u043D\u044F \u043F\u0440\u0438\u0437\u0443\u043F\u0438\u043D\u0435\u043D\u043E.",
    "zh-cn": "{name}\uFF1A\u592A\u9633\u4F20\u611F\u5668\u62A5\u544A\u6545\u969C\u3002\u8DDF\u8E2A\u5DF2\u6682\u505C\u3002"
  },
  sunBack: {
    en: "{name}: the sun sensor works again.",
    de: "{name}: Der Sonnensensor arbeitet wieder.",
    ru: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0441\u043E\u043B\u043D\u0446\u0430 \u0441\u043D\u043E\u0432\u0430 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442.",
    pt: "{name}: o sensor solar voltou a funcionar.",
    nl: "{name}: de zonnesensor werkt weer.",
    fr: "{name} : le capteur solaire fonctionne de nouveau.",
    it: "{name}: il sensore solare funziona di nuovo.",
    es: "{name}: el sensor solar vuelve a funcionar.",
    pl: "{name}: czujnik s\u0142o\u0144ca zn\xF3w dzia\u0142a.",
    uk: "{name}: \u0434\u0430\u0442\u0447\u0438\u043A \u0441\u043E\u043D\u0446\u044F \u0437\u043D\u043E\u0432\u0443 \u043F\u0440\u0430\u0446\u044E\u0454.",
    "zh-cn": "{name}\uFF1A\u592A\u9633\u4F20\u611F\u5668\u5DF2\u6062\u590D\u5DE5\u4F5C\u3002"
  },
  connectionLost: {
    en: "{name}: no connection to the device for {minutes} minute(s). The tracker keeps working on its own, but ioBroker receives no messages.",
    de: "{name}: Seit {minutes} Minute(n) keine Verbindung zum Ger\xE4t. Der Tracker arbeitet selbstst\xE4ndig weiter, ioBroker erh\xE4lt aber keine Meldungen.",
    ru: "{name}: \u043D\u0435\u0442 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0441 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E\u043C \u0443\u0436\u0435 {minutes} \u043C\u0438\u043D. \u0422\u0440\u0435\u043A\u0435\u0440 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E, \u043D\u043E ioBroker \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.",
    pt: "{name}: sem liga\xE7\xE3o ao dispositivo h\xE1 {minutes} minuto(s). O seguidor continua a funcionar sozinho, mas o ioBroker n\xE3o recebe mensagens.",
    nl: "{name}: al {minutes} minuut/minuten geen verbinding met het apparaat. De tracker werkt zelfstandig verder, maar ioBroker ontvangt geen meldingen.",
    fr: "{name} : aucune connexion \xE0 l'appareil depuis {minutes} minute(s). Le suiveur continue de fonctionner seul, mais ioBroker ne re\xE7oit aucun message.",
    it: "{name}: nessuna connessione al dispositivo da {minutes} minuto/i. L'inseguitore continua a funzionare da solo, ma ioBroker non riceve messaggi.",
    es: "{name}: sin conexi\xF3n con el dispositivo desde hace {minutes} minuto(s). El seguidor sigue funcionando por s\xED solo, pero ioBroker no recibe mensajes.",
    pl: "{name}: brak po\u0142\u0105czenia z urz\u0105dzeniem od {minutes} min. Tracker dzia\u0142a dalej samodzielnie, ale ioBroker nie otrzymuje komunikat\xF3w.",
    uk: "{name}: \u043D\u0435\u043C\u0430\u0454 \u0437'\u0454\u0434\u043D\u0430\u043D\u043D\u044F \u0437 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0454\u043C \u0443\u0436\u0435 {minutes} \u0445\u0432. \u0422\u0440\u0435\u043A\u0435\u0440 \u043F\u0440\u043E\u0434\u043E\u0432\u0436\u0443\u0454 \u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438 \u0441\u0430\u043C\u043E\u0441\u0442\u0456\u0439\u043D\u043E, \u0430\u043B\u0435 ioBroker \u043D\u0435 \u043E\u0442\u0440\u0438\u043C\u0443\u0454 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u044C.",
    "zh-cn": "{name}\uFF1A\u5DF2\u6709 {minutes} \u5206\u949F\u65E0\u6CD5\u8FDE\u63A5\u8BBE\u5907\u3002\u8DDF\u8E2A\u5668\u4ECD\u53EF\u72EC\u7ACB\u5DE5\u4F5C\uFF0C\u4F46 ioBroker \u6536\u4E0D\u5230\u6D88\u606F\u3002"
  },
  connectionRestored: {
    en: "{name}: the connection to the device is restored.",
    de: "{name}: Die Verbindung zum Ger\xE4t besteht wieder.",
    ru: "{name}: \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E\u043C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E.",
    pt: "{name}: a liga\xE7\xE3o ao dispositivo foi restabelecida.",
    nl: "{name}: de verbinding met het apparaat is hersteld.",
    fr: "{name} : la connexion \xE0 l'appareil est r\xE9tablie.",
    it: "{name}: la connessione al dispositivo \xE8 stata ripristinata.",
    es: "{name}: se ha restablecido la conexi\xF3n con el dispositivo.",
    pl: "{name}: po\u0142\u0105czenie z urz\u0105dzeniem zosta\u0142o przywr\xF3cone.",
    uk: "{name}: \u0437'\u0454\u0434\u043D\u0430\u043D\u043D\u044F \u0437 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0454\u043C \u0432\u0456\u0434\u043D\u043E\u0432\u043B\u0435\u043D\u043E.",
    "zh-cn": "{name}\uFF1A\u4E0E\u8BBE\u5907\u7684\u8FDE\u63A5\u5DF2\u6062\u590D\u3002"
  },
  deviceRestarted: {
    en: "{name}: the device has restarted (reason: {reason}).",
    de: "{name}: Das Ger\xE4t hat neu gestartet (Grund: {reason}).",
    ru: "{name}: \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u043E\u0441\u044C (\u043F\u0440\u0438\u0447\u0438\u043D\u0430: {reason}).",
    pt: "{name}: o dispositivo reiniciou (motivo: {reason}).",
    nl: "{name}: het apparaat is opnieuw gestart (reden: {reason}).",
    fr: "{name} : l'appareil a red\xE9marr\xE9 (raison : {reason}).",
    it: "{name}: il dispositivo si \xE8 riavviato (motivo: {reason}).",
    es: "{name}: el dispositivo se ha reiniciado (motivo: {reason}).",
    pl: "{name}: urz\u0105dzenie uruchomi\u0142o si\u0119 ponownie (pow\xF3d: {reason}).",
    uk: "{name}: \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0432\u0441\u044F (\u043F\u0440\u0438\u0447\u0438\u043D\u0430: {reason}).",
    "zh-cn": "{name}\uFF1A\u8BBE\u5907\u5DF2\u91CD\u65B0\u542F\u52A8\uFF08\u539F\u56E0\uFF1A{reason}\uFF09\u3002"
  }
};
const MESSAGING_ADAPTERS = [
  "telegram",
  "pushover",
  "email",
  "whatsapp-cmb",
  "signal-cmb",
  "discord",
  "matrix-org",
  "gotify",
  "ntfy",
  "notification-manager"
];
function messagingOptions(instanceIds) {
  const options = [];
  for (const id of instanceIds) {
    const match = /^system\.adapter\.([^.]+)\.(\d+)$/.exec(id);
    if (match && MESSAGING_ADAPTERS.includes(match[1])) {
      const value = `${match[1]}.${match[2]}`;
      options.push({ value, label: value });
    }
  }
  return options.sort((a, b) => a.value.localeCompare(b.value));
}
function supportedLanguage(language) {
  return LANGUAGES.includes(language) ? language : "en";
}
function translate(key, language, params) {
  const texts = NOTIFICATIONS[key];
  if (!texts) {
    return `${key} ${JSON.stringify(params)}`;
  }
  return texts[supportedLanguage(language)].replace(
    /\{(\w+)\}/g,
    (match, name) => name in params ? String(params[name]) : match
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LANGUAGES,
  MESSAGING_ADAPTERS,
  NOTIFICATIONS,
  messagingOptions,
  supportedLanguage,
  translate
});
//# sourceMappingURL=notifications.js.map
