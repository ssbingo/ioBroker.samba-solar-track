/*
 * Shared CSS of all Samba Solar Track widgets, injected once per page.
 *
 * Colours, tiles and status band follow the design "0: Standard" of the device (the approved preview of the
 * widgets): background #12161F, tiles #1E2538, text #FFFFFF, muted #8A93A6, primary #2196F3, accent #FFCC00 and
 * the colours of the status band (blue, green, orange, red, grey, night, violet).
 * Font: Montserrat (SIL Open Font License 1.1, bundled; latin, latin-ext and cyrillic) with Arial as fallback.
 */
const FONT_FILES: { weight: number; subset: string; range: string; url: string }[] = [];

const RANGES: Record<string, string> = {
    latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    "latin-ext":
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    cyrillic: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
};

// Vite turns every `new URL(<literal>, import.meta.url)` into a hashed asset next to the widget code.
FONT_FILES.push(
    {
        weight: 400,
        subset: "latin",
        range: RANGES.latin,
        url: new URL("./fonts/montserrat-latin-400-normal.woff2", import.meta.url).href,
    },
    {
        weight: 600,
        subset: "latin",
        range: RANGES.latin,
        url: new URL("./fonts/montserrat-latin-600-normal.woff2", import.meta.url).href,
    },
    {
        weight: 700,
        subset: "latin",
        range: RANGES.latin,
        url: new URL("./fonts/montserrat-latin-700-normal.woff2", import.meta.url).href,
    },
    {
        weight: 400,
        subset: "latin-ext",
        range: RANGES["latin-ext"],
        url: new URL("./fonts/montserrat-latin-ext-400-normal.woff2", import.meta.url).href,
    },
    {
        weight: 600,
        subset: "latin-ext",
        range: RANGES["latin-ext"],
        url: new URL("./fonts/montserrat-latin-ext-600-normal.woff2", import.meta.url).href,
    },
    {
        weight: 700,
        subset: "latin-ext",
        range: RANGES["latin-ext"],
        url: new URL("./fonts/montserrat-latin-ext-700-normal.woff2", import.meta.url).href,
    },
    {
        weight: 400,
        subset: "cyrillic",
        range: RANGES.cyrillic,
        url: new URL("./fonts/montserrat-cyrillic-400-normal.woff2", import.meta.url).href,
    },
    {
        weight: 600,
        subset: "cyrillic",
        range: RANGES.cyrillic,
        url: new URL("./fonts/montserrat-cyrillic-600-normal.woff2", import.meta.url).href,
    },
    {
        weight: 700,
        subset: "cyrillic",
        range: RANGES.cyrillic,
        url: new URL("./fonts/montserrat-cyrillic-700-normal.woff2", import.meta.url).href,
    },
);

/** Colours of the status band, as `pal()` of the display in the design "0: Standard" */
export const BAND_COLORS = {
    blue: "#2980B9",
    green: "#27AE60",
    orange: "#E67E22",
    red: "#C0392B",
    gray: "#7F8C8D",
    night: "#34495E",
    violet: "#8E44AD",
} as const;

/** Name of a colour of the status band */
export type BandColor = keyof typeof BAND_COLORS;

const FONT_FACES = FONT_FILES.map(
    f =>
        `@font-face{font-family:"SST Montserrat";font-style:normal;font-display:swap;font-weight:${f.weight};` +
        `src:local("Montserrat"),url(${f.url}) format("woff2");unicode-range:${f.range}}`,
).join("\n");

const CSS = `
${FONT_FACES}
.sst{--sst-bg:#12161F;--sst-panel:#1E2538;--sst-line:#2a3350;--sst-fg:#FFFFFF;--sst-muted:#8A93A6;--sst-accent:#2196F3;
  --sst-gold:#FFCC00;--sst-man:${BAND_COLORS.blue};--sst-auto:${BAND_COLORS.green};--sst-warn:${BAND_COLORS.orange};
  --sst-err:${BAND_COLORS.red};--sst-idle:${BAND_COLORS.gray};--sst-dark:${BAND_COLORS.night};--sst-night:${BAND_COLORS.violet};
  --sst-font:"SST Montserrat","Montserrat",Arial,Helvetica,sans-serif;
  box-sizing:border-box;width:100%;height:100%;color:var(--sst-fg);font-family:var(--sst-font);border-radius:10px;padding:8px;
  display:flex;flex-direction:column;gap:6px;overflow:hidden;font-variant-numeric:tabular-nums;line-height:1.25;text-align:left}
.sst *{box-sizing:border-box}
.sst.sst-rel{position:relative}
.sst.sst-card{background:var(--sst-bg);border:1px solid var(--sst-line)}
.sst-head{display:flex;align-items:center;gap:8px;min-height:24px;flex:0 0 auto}
.sst-logo{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 50% 45%,#ffd54a 0 38%,#f5a400 39% 60%,#2b1d05 61%);flex:0 0 auto}
.sst-ttl{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sst-conn{font-size:9px;color:var(--sst-muted);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.sst-sw{width:30px;height:16px;border-radius:9px;background:#3a4256;position:relative;flex:0 0 auto;border:0;padding:0;cursor:pointer}
.sst-sw::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left .15s}
.sst-sw[aria-checked="true"]{background:var(--sst-accent)}
.sst-sw[aria-checked="true"]::after{left:16px}
.sst-sw:disabled{opacity:.45;cursor:not-allowed}
.sst-tiles{display:grid;gap:6px;flex:1 1 auto;min-height:0}
.sst-tile{background:var(--sst-panel);border-radius:6px;padding:6px 8px;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.sst-k{font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--sst-muted);font-weight:600}
.sst-kr{display:flex;justify-content:space-between;align-items:baseline;gap:6px;min-width:0}
.sst-kr>*{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sst-gold{color:var(--sst-gold)}
.sst-tile>div.sst-mid,.sst-tile>div.sst-small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sst-band{border-radius:6px;padding:7px 10px;font-size:12px;font-weight:600;letter-spacing:.02em;display:flex;align-items:center;gap:8px;min-height:30px;flex:0 0 auto;color:#fff}
.sst-band .sst-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sst-pill{background:#fff;color:#12161F;border-radius:999px;padding:4px 10px;font:700 9px var(--sst-font);letter-spacing:.04em;flex:0 0 auto;border:0;cursor:pointer;text-transform:uppercase}
.sst-pill:disabled{opacity:.45;cursor:not-allowed}
.sst-small{font-size:10px;color:var(--sst-muted)}
.sst-small.sst-gold{color:var(--sst-gold)}
.sst-big{font-size:22px;font-weight:600;line-height:1}
.sst-mid{font-size:12px;font-weight:600}
.sst-note{font-size:9.5px;color:var(--sst-muted);line-height:1.35}
.sst-ok{color:#5fd68a}.sst-bad{color:#ff8a7f}.sst-warnc{color:#ffb062}
.sst svg text{font-family:var(--sst-font)}
.sst-hint{flex:1 1 auto;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--sst-muted);font-size:12px;padding:8px}

/* control */
.sst-btn{font:700 11px var(--sst-font);letter-spacing:.04em;color:#fff;background:#3a4f73;border:0;border-radius:8px;padding:10px 6px;cursor:pointer;
  text-transform:uppercase;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;user-select:none;-webkit-user-select:none;
  touch-action:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.sst-btn.sst-on{background:var(--sst-accent)}
.sst-btn:disabled{opacity:.45;cursor:not-allowed}
.sst-btn.sst-held{background:var(--sst-accent);box-shadow:0 0 0 2px var(--sst-gold) inset}
.sst-btn .sst-ar{font-size:14px;line-height:1}
.sst-grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.sst-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.sst-gridn{display:grid;gap:5px}
.sst-gridn .sst-btn{padding:8px 2px;font-size:11px}
.sst-btn.sst-park{background:#fff;color:#12161F}
.sst-btn.sst-ack{background:var(--sst-warn)}
.sst-btn.sst-danger{background:var(--sst-err)}
.sst-dialog{position:absolute;inset:0;background:rgba(12,15,21,.92);display:flex;flex-direction:column;justify-content:center;gap:10px;padding:14px;border-radius:10px;z-index:2}
.sst-dialog p{margin:0;font-size:12px;line-height:1.4}

/* messages */
.sst-log{display:flex;flex-direction:column;gap:3px;overflow:hidden;flex:1 1 auto;min-height:0}
.sst-ln{display:grid;grid-template-columns:44px 26px 1fr;gap:6px;align-items:baseline;background:var(--sst-panel);border-radius:5px;padding:4px 6px;font-size:10.5px}
.sst-ln time{color:var(--sst-muted)}
.sst-ln>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sst-lv{font-size:8.5px;font-weight:700;border-radius:4px;text-align:center;padding:1px 0}
.sst-lv.sst-i{background:#24406a;color:#8cc4ff}.sst-lv.sst-w{background:#5c3a12;color:#ffb062}.sst-lv.sst-e{background:#5a1d18;color:#ff8a7f}
.sst-lv.sst-d{background:#2c3448;color:#8A93A6}
.sst-chips{display:flex;gap:5px;flex:0 0 auto}
.sst-chip{font:600 10px var(--sst-font);background:var(--sst-panel);color:var(--sst-fg);border:1px solid var(--sst-line);border-radius:999px;padding:3px 9px;cursor:pointer}
.sst-chip[aria-pressed="true"]{background:var(--sst-accent);border-color:var(--sst-accent)}

/* values */
.sst-vals{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;flex:1 1 auto;align-content:start;min-height:0}
.sst-v{background:var(--sst-panel);border-radius:6px;padding:6px 6px 5px;min-width:0}
.sst-v .sst-k{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.sst-v .sst-n{font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sst-v .sst-u{font-size:9px;color:var(--sst-muted);margin-left:2px;font-weight:500}
.sst-bar{height:8px;background:var(--sst-panel);border-radius:4px;overflow:hidden;flex:0 0 auto}
.sst-bar>div{height:100%;background:var(--sst-auto)}

.sst button:focus-visible{outline:2px solid var(--sst-gold);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.sst-sw::after{transition:none}}
`;

let injected = false;

/** Injects the shared CSS (and the font faces) once per page. */
export function injectStyles(): void {
    if (injected || typeof document === "undefined") {
        return;
    }
    if (document.getElementById("sst-widget-styles")) {
        injected = true;
        return;
    }
    const style = document.createElement("style");
    style.id = "sst-widget-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
    injected = true;
}
