/*
 * Texts of the notifications in every language ioBroker supports.
 * Notifications go to people, so they are written in the system language; log lines stay English.
 * Placeholders are written as {name}.
 */

/** Languages of ioBroker */
export const LANGUAGES = ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"] as const;

/** Language of ioBroker */
export type Language = (typeof LANGUAGES)[number];

/** Texts by key and language. {name} is the name of the device. */
export const NOTIFICATIONS: Record<string, Record<Language, string>> = {
    stormStarted: {
        en: "{name}: storm protection active. Gust {gust} km/h, threshold {threshold} km/h. The module drives to the flat position.",
        de: "{name}: Sturmschutz aktiv. Böe {gust} km/h, Schwelle {threshold} km/h. Das Modul fährt in die Flachstellung.",
        ru: "{name}: защита от шторма активна. Порыв {gust} км/ч, порог {threshold} км/ч. Модуль переходит в горизонтальное положение.",
        pt: "{name}: proteção contra tempestades ativa. Rajada {gust} km/h, limite {threshold} km/h. O módulo desloca-se para a posição horizontal.",
        nl: "{name}: stormbeveiliging actief. Windstoot {gust} km/u, drempel {threshold} km/u. Het paneel rijdt naar de vlakke stand.",
        fr: "{name} : protection contre les tempêtes active. Rafale {gust} km/h, seuil {threshold} km/h. Le module se met à plat.",
        it: "{name}: protezione dalle tempeste attiva. Raffica {gust} km/h, soglia {threshold} km/h. Il modulo si porta in posizione orizzontale.",
        es: "{name}: protección contra tormentas activa. Racha {gust} km/h, umbral {threshold} km/h. El módulo se desplaza a la posición horizontal.",
        pl: "{name}: ochrona przed burzą aktywna. Poryw {gust} km/h, próg {threshold} km/h. Moduł ustawia się w pozycji poziomej.",
        uk: "{name}: захист від шторму активний. Порив {gust} км/год, поріг {threshold} км/год. Модуль переходить у горизонтальне положення.",
        "zh-cn": "{name}：风暴保护已启动。阵风 {gust} km/h，阈值 {threshold} km/h。组件正在转到水平位置。",
    },
    stormEnded: {
        en: "{name}: storm protection ended.",
        de: "{name}: Sturmschutz beendet.",
        ru: "{name}: защита от шторма завершена.",
        pt: "{name}: proteção contra tempestades terminada.",
        nl: "{name}: stormbeveiliging beëindigd.",
        fr: "{name} : protection contre les tempêtes terminée.",
        it: "{name}: protezione dalle tempeste terminata.",
        es: "{name}: protección contra tormentas finalizada.",
        pl: "{name}: ochrona przed burzą zakończona.",
        uk: "{name}: захист від шторму завершено.",
        "zh-cn": "{name}：风暴保护已结束。",
    },
    faultMotor: {
        en: "{name}: fault. A drive ran longer than its maximum runtime ({axes}). Check the mechanics, then acknowledge the fault at the display or in ioBroker.",
        de: "{name}: Störung. Ein Antrieb lief länger als seine Höchstlaufzeit ({axes}). Mechanik prüfen, dann die Störung am Display oder in ioBroker quittieren.",
        ru: "{name}: неисправность. Привод работал дольше максимального времени ({axes}). Проверьте механику, затем подтвердите неисправность на дисплее или в ioBroker.",
        pt: "{name}: avaria. Um acionamento funcionou mais tempo do que o máximo permitido ({axes}). Verifique a mecânica e confirme a avaria no ecrã ou no ioBroker.",
        nl: "{name}: storing. Een aandrijving liep langer dan de maximale looptijd ({axes}). Controleer de mechaniek en bevestig de storing op het display of in ioBroker.",
        fr: "{name} : défaut. Un entraînement a fonctionné plus longtemps que sa durée maximale ({axes}). Vérifiez la mécanique, puis acquittez le défaut à l'écran ou dans ioBroker.",
        it: "{name}: guasto. Un azionamento ha funzionato più a lungo del tempo massimo ({axes}). Controllare la meccanica, poi confermare il guasto sul display o in ioBroker.",
        es: "{name}: avería. Un accionamiento funcionó más tiempo que el máximo permitido ({axes}). Compruebe la mecánica y confirme la avería en la pantalla o en ioBroker.",
        pl: "{name}: usterka. Napęd pracował dłużej niż maksymalny czas pracy ({axes}). Sprawdź mechanikę, a następnie potwierdź usterkę na wyświetlaczu lub w ioBroker.",
        uk: "{name}: несправність. Привід працював довше за максимальний час ({axes}). Перевірте механіку, потім підтвердьте несправність на дисплеї або в ioBroker.",
        "zh-cn":
            "{name}：故障。驱动器运行时间超过最长运行时间（{axes}）。请检查机械部分，然后在显示屏或 ioBroker 中确认故障。",
    },
    faultIo: {
        en: "{name}: fault. The component of the switching outputs does not answer. All outputs are switched off.",
        de: "{name}: Störung. Der Baustein der Schaltausgänge antwortet nicht. Alle Ausgänge sind ausgeschaltet.",
        ru: "{name}: неисправность. Модуль коммутационных выходов не отвечает. Все выходы отключены.",
        pt: "{name}: avaria. O componente das saídas de comutação não responde. Todas as saídas estão desligadas.",
        nl: "{name}: storing. De component van de schakeluitgangen antwoordt niet. Alle uitgangen zijn uitgeschakeld.",
        fr: "{name} : défaut. Le composant des sorties de commutation ne répond pas. Toutes les sorties sont coupées.",
        it: "{name}: guasto. Il componente delle uscite di commutazione non risponde. Tutte le uscite sono disattivate.",
        es: "{name}: avería. El componente de las salidas de conmutación no responde. Todas las salidas están desconectadas.",
        pl: "{name}: usterka. Układ wyjść przełączających nie odpowiada. Wszystkie wyjścia są wyłączone.",
        uk: "{name}: несправність. Модуль комутаційних виходів не відповідає. Усі виходи вимкнено.",
        "zh-cn": "{name}：故障。开关输出组件无响应。所有输出均已关闭。",
    },
    faultCleared: {
        en: "{name}: the fault is cleared.",
        de: "{name}: Die Störung ist behoben.",
        ru: "{name}: неисправность устранена.",
        pt: "{name}: a avaria foi resolvida.",
        nl: "{name}: de storing is verholpen.",
        fr: "{name} : le défaut est supprimé.",
        it: "{name}: il guasto è stato risolto.",
        es: "{name}: la avería se ha resuelto.",
        pl: "{name}: usterka została usunięta.",
        uk: "{name}: несправність усунено.",
        "zh-cn": "{name}：故障已排除。",
    },
    windLost: {
        en: "{name}: the wind sensor does not answer. Automatic mode drives the module flat and stays blocked until the sensor answers again.",
        de: "{name}: Der Windmesser antwortet nicht. Die Automatik fährt das Modul flach und bleibt gesperrt, bis er wieder antwortet.",
        ru: "{name}: датчик ветра не отвечает. Автоматика переводит модуль в горизонтальное положение и остаётся заблокированной, пока датчик не ответит.",
        pt: "{name}: o sensor de vento não responde. O modo automático coloca o módulo na horizontal e fica bloqueado até o sensor voltar a responder.",
        nl: "{name}: de windmeter antwoordt niet. De automaat zet het paneel vlak en blijft geblokkeerd tot de windmeter weer antwoordt.",
        fr: "{name} : l'anémomètre ne répond pas. Le mode automatique met le module à plat et reste bloqué jusqu'à ce qu'il réponde de nouveau.",
        it: "{name}: l'anemometro non risponde. La modalità automatica porta il modulo in piano e resta bloccata finché non risponde di nuovo.",
        es: "{name}: el anemómetro no responde. El modo automático coloca el módulo en horizontal y queda bloqueado hasta que vuelva a responder.",
        pl: "{name}: wiatromierz nie odpowiada. Automatyka ustawia moduł na płasko i pozostaje zablokowana, dopóki czujnik znów nie odpowie.",
        uk: "{name}: датчик вітру не відповідає. Автоматика переводить модуль у горизонтальне положення і залишається заблокованою, доки датчик не відповість.",
        "zh-cn": "{name}：风速计无响应。自动模式将组件放平并保持锁定，直到风速计恢复响应。",
    },
    windBack: {
        en: "{name}: the wind sensor answers again.",
        de: "{name}: Der Windmesser antwortet wieder.",
        ru: "{name}: датчик ветра снова отвечает.",
        pt: "{name}: o sensor de vento voltou a responder.",
        nl: "{name}: de windmeter antwoordt weer.",
        fr: "{name} : l'anémomètre répond de nouveau.",
        it: "{name}: l'anemometro risponde di nuovo.",
        es: "{name}: el anemómetro vuelve a responder.",
        pl: "{name}: wiatromierz znów odpowiada.",
        uk: "{name}: датчик вітру знову відповідає.",
        "zh-cn": "{name}：风速计已恢复响应。",
    },
    sunLost: {
        en: "{name}: the sun sensor reports a fault. Tracking pauses.",
        de: "{name}: Der Sonnensensor meldet eine Störung. Die Nachführung pausiert.",
        ru: "{name}: датчик солнца сообщает о неисправности. Слежение приостановлено.",
        pt: "{name}: o sensor solar comunica uma avaria. O seguimento está em pausa.",
        nl: "{name}: de zonnesensor meldt een storing. Het volgen pauzeert.",
        fr: "{name} : le capteur solaire signale un défaut. Le suivi est en pause.",
        it: "{name}: il sensore solare segnala un guasto. L'inseguimento è in pausa.",
        es: "{name}: el sensor solar comunica una avería. El seguimiento está en pausa.",
        pl: "{name}: czujnik słońca zgłasza usterkę. Śledzenie jest wstrzymane.",
        uk: "{name}: датчик сонця повідомляє про несправність. Стеження призупинено.",
        "zh-cn": "{name}：太阳传感器报告故障。跟踪已暂停。",
    },
    sunBack: {
        en: "{name}: the sun sensor works again.",
        de: "{name}: Der Sonnensensor arbeitet wieder.",
        ru: "{name}: датчик солнца снова работает.",
        pt: "{name}: o sensor solar voltou a funcionar.",
        nl: "{name}: de zonnesensor werkt weer.",
        fr: "{name} : le capteur solaire fonctionne de nouveau.",
        it: "{name}: il sensore solare funziona di nuovo.",
        es: "{name}: el sensor solar vuelve a funcionar.",
        pl: "{name}: czujnik słońca znów działa.",
        uk: "{name}: датчик сонця знову працює.",
        "zh-cn": "{name}：太阳传感器已恢复工作。",
    },
    connectionLost: {
        en: "{name}: no connection to the device for {minutes} minute(s). The tracker keeps working on its own, but ioBroker receives no messages.",
        de: "{name}: Seit {minutes} Minute(n) keine Verbindung zum Gerät. Der Tracker arbeitet selbstständig weiter, ioBroker erhält aber keine Meldungen.",
        ru: "{name}: нет соединения с устройством уже {minutes} мин. Трекер продолжает работать самостоятельно, но ioBroker не получает сообщений.",
        pt: "{name}: sem ligação ao dispositivo há {minutes} minuto(s). O seguidor continua a funcionar sozinho, mas o ioBroker não recebe mensagens.",
        nl: "{name}: al {minutes} minuut/minuten geen verbinding met het apparaat. De tracker werkt zelfstandig verder, maar ioBroker ontvangt geen meldingen.",
        fr: "{name} : aucune connexion à l'appareil depuis {minutes} minute(s). Le suiveur continue de fonctionner seul, mais ioBroker ne reçoit aucun message.",
        it: "{name}: nessuna connessione al dispositivo da {minutes} minuto/i. L'inseguitore continua a funzionare da solo, ma ioBroker non riceve messaggi.",
        es: "{name}: sin conexión con el dispositivo desde hace {minutes} minuto(s). El seguidor sigue funcionando por sí solo, pero ioBroker no recibe mensajes.",
        pl: "{name}: brak połączenia z urządzeniem od {minutes} min. Tracker działa dalej samodzielnie, ale ioBroker nie otrzymuje komunikatów.",
        uk: "{name}: немає з'єднання з пристроєм уже {minutes} хв. Трекер продовжує працювати самостійно, але ioBroker не отримує повідомлень.",
        "zh-cn": "{name}：已有 {minutes} 分钟无法连接设备。跟踪器仍可独立工作，但 ioBroker 收不到消息。",
    },
    connectionRestored: {
        en: "{name}: the connection to the device is restored.",
        de: "{name}: Die Verbindung zum Gerät besteht wieder.",
        ru: "{name}: соединение с устройством восстановлено.",
        pt: "{name}: a ligação ao dispositivo foi restabelecida.",
        nl: "{name}: de verbinding met het apparaat is hersteld.",
        fr: "{name} : la connexion à l'appareil est rétablie.",
        it: "{name}: la connessione al dispositivo è stata ripristinata.",
        es: "{name}: se ha restablecido la conexión con el dispositivo.",
        pl: "{name}: połączenie z urządzeniem zostało przywrócone.",
        uk: "{name}: з'єднання з пристроєм відновлено.",
        "zh-cn": "{name}：与设备的连接已恢复。",
    },
    deviceRestarted: {
        en: "{name}: the device has restarted (reason: {reason}).",
        de: "{name}: Das Gerät hat neu gestartet (Grund: {reason}).",
        ru: "{name}: устройство перезапустилось (причина: {reason}).",
        pt: "{name}: o dispositivo reiniciou (motivo: {reason}).",
        nl: "{name}: het apparaat is opnieuw gestart (reden: {reason}).",
        fr: "{name} : l'appareil a redémarré (raison : {reason}).",
        it: "{name}: il dispositivo si è riavviato (motivo: {reason}).",
        es: "{name}: el dispositivo se ha reiniciado (motivo: {reason}).",
        pl: "{name}: urządzenie uruchomiło się ponownie (powód: {reason}).",
        uk: "{name}: пристрій перезапустився (причина: {reason}).",
        "zh-cn": "{name}：设备已重新启动（原因：{reason}）。",
    },
};

/** Adapters that deliver a message with sendTo(instance, "send", { text }) */
export const MESSAGING_ADAPTERS = [
    "telegram",
    "pushover",
    "email",
    "whatsapp-cmb",
    "signal-cmb",
    "discord",
    "matrix-org",
    "gotify",
    "ntfy",
    "notification-manager",
];

/**
 * The instances of messaging adapters among all instances, as options for the settings page.
 *
 * @param instanceIds ids of instance objects, e.g. "system.adapter.telegram.0"
 * @returns options sorted by name, e.g. { value: "telegram.0", label: "telegram.0" }
 */
export function messagingOptions(instanceIds: string[]): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = [];
    for (const id of instanceIds) {
        const match = /^system\.adapter\.([^.]+)\.(\d+)$/.exec(id);
        if (match && MESSAGING_ADAPTERS.includes(match[1])) {
            const value = `${match[1]}.${match[2]}`;
            options.push({ value, label: value });
        }
    }
    return options.sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * Chooses a supported language.
 *
 * @param language language of the system, may be missing or unknown
 * @returns the language, English when it is not supported
 */
export function supportedLanguage(language: unknown): Language {
    return (LANGUAGES as readonly unknown[]).includes(language) ? (language as Language) : "en";
}

/**
 * Text of a notification.
 *
 * @param key key of the text
 * @param language language of the system
 * @param params values for the placeholders
 * @returns the text; for an unknown key the key itself with its values
 */
export function translate(key: string, language: unknown, params: Record<string, string | number>): string {
    const texts = NOTIFICATIONS[key];
    if (!texts) {
        return `${key} ${JSON.stringify(params)}`;
    }
    return texts[supportedLanguage(language)].replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match,
    );
}
