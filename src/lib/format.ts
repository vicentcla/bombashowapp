export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

/** Formatea una cadena de dígitos (mmss) como mm:ss con los dos puntos automáticos. */
export function formatDurationInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!digits) return "";
  if (digits.length <= 2) return `0:${digits.padStart(2, "0")}`;
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

/** Convierte los dígitos de un campo mm:ss (p. ej. "245" => 2:45) a segundos. */
export function durationInputToSeconds(raw: string): number {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!digits) return 0;
  if (digits.length <= 2) return parseInt(digits, 10) || 0;
  return (parseInt(digits.slice(0, -2), 10) || 0) * 60 + (parseInt(digits.slice(-2), 10) || 0);
}

/** Convierte segundos a dígitos para pre-rellenar el campo mm:ss (p. ej. 165 => "245"). */
export function durationSecondsToInput(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `${m}${String(rest).padStart(2, "0")}` : String(rest).padStart(2, "0");
}

export function formatLongDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(rest).padStart(2, "0")}s`;
  return `${m}m ${String(rest).padStart(2, "0")}s`;
}

export function formatMinutesToHours(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60);
  const restM = m % 60;
  if (h > 0) {
    return restM > 0 ? `${h}h ${restM}min` : `${h}h`;
  }
  return `${m}min`;
}

export function formatTimeComparison(addedSeconds: number, targetMinutes: number) {
  const targetSeconds = targetMinutes * 60;
  const percentage =
    targetSeconds > 0 ? Math.min(100, Math.round((addedSeconds / targetSeconds) * 100)) : 0;
  const diffSeconds = addedSeconds - targetSeconds;

  let status: "pending" | "exact" | "exceeded" = "pending";
  if (targetSeconds > 0) {
    if (Math.abs(diffSeconds) <= 60) status = "exact";
    else if (diffSeconds > 60) status = "exceeded";
  }

  return {
    percentage,
    status,
    diffSeconds,
    addedText: formatLongDuration(addedSeconds),
    targetText: formatMinutesToHours(targetMinutes),
    diffText:
      targetSeconds === 0
        ? "Sin objetivo"
        : diffSeconds === 0
          ? "¡Duración exacta!"
          : diffSeconds > 0
            ? `+${formatLongDuration(diffSeconds)}`
            : `-${formatLongDuration(Math.abs(diffSeconds))}`,
  };
}

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "DIV", "HR", "SPAN"]);

const VOID_CONTENT_TAGS = /<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const OPEN_CONTENT_TAGS = /<\/?(script|style|iframe|object|embed|svg|math)\b[^>]*>/gi;

/**
 * Limpia el HTML de letras dejando solo negrita, cursiva, subrayado y saltos.
 * Funciona tanto en el navegador como en el servidor (sin DOM) y se aplica
 * también al renderizar, no solo al guardar.
 */
export function sanitizeLyricsHtml(html: string): string {
  if (!html) return "";

  const stripped = html.replace(VOID_CONTENT_TAGS, "").replace(OPEN_CONTENT_TAGS, "");

  // Elimina cualquier etiqueta no permitida y todos los atributos de las permitidas.
  const cleaned = stripped.replace(/<\/?([a-zA-Z0-9-]+)\b[^>]*?(\/?)>/g, (_match, rawTag, selfClose) => {
    const tag = String(rawTag).toUpperCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const isClosing = _match.startsWith("</");
    const lower = tag.toLowerCase();
    if (isClosing) return `</${lower}>`;
    if (tag === "BR" || tag === "HR") return `<${lower} />`;
    return selfClose ? `<${lower}></${lower}>` : `<${lower}>`;
  });

  // Neutraliza restos de comentarios y secuencias peligrosas.
  return cleaned.replace(/<!--[\s\S]*?-->/g, "");
}


export function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ");
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Formatea un texto plano de letra con subtítulos iniciados por '-' en HTML con negritas y separadores. */
export function formatLyricsWithSubtitles(text: string): string {
  if (!text || !text.trim()) return "";

  // Si ya es HTML con etiquetas de párrafo o bloques, retornamos saneado
  if (text.includes("<p>") || text.includes("<div>") || text.includes("<br")) {
    return sanitizeLyricsHtml(text);
  }

  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let currentParagraph: string[] = [];
  let isFirstSubtitle = true;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      htmlParts.push(`<p>${currentParagraph.join("<br />")}</p>`);
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("-")) {
      flushParagraph();
      if (!isFirstSubtitle) {
        htmlParts.push("<hr />");
      }
      isFirstSubtitle = false;
      // Quitar el guión inicial para que el subtítulo muestre solo el texto en negrita
      const subtitleText = trimmed.replace(/^-+\s*/, "").trim();
      htmlParts.push(`<p><strong>${subtitleText}</strong></p>`);
    } else if (trimmed === "") {
      flushParagraph();
    } else {
      currentParagraph.push(trimmed);
    }
  }
  flushParagraph();

  return htmlParts.join("");
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type UnicodeStyle =
  | "bold"
  | "italic"
  | "boldItalic"
  | "mono"
  | "sans"
  | "sansBold"
  | "sansItalic"
  | "sansBoldItalic"
  | "script"
  | "scriptBold"
  | "fraktur"
  | "frakturBold"
  | "doubleStruck"
  | "circled"
  | "squared"
  | "squaredNegative"
  | "parenthesized"
  | "fullwidth";

type UnicodeFont = {
  upper: string;
  lower: string;
  digits?: string;
  /** Cuando es true, las minúsculas usan la variante de mayúscula. */
  upperForLower?: boolean;
};

const LATIN_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LATIN_LOWER = "abcdefghijklmnopqrstuvwxyz";
const LATIN_DIGITS = "0123456789";

const UNICODE_STYLES: Record<UnicodeStyle, UnicodeFont> = {
  bold: {
    upper: "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙",
    lower: "𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳",
    digits: "𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗",
  },
  italic: {
    upper: "𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍",
    lower: "𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧",
  },
  boldItalic: {
    upper: "𝑨𝑩𝑪𝑫𝑬𝑭𝑮𝑯𝑰𝑱𝑲𝑳𝑴𝑵𝑶𝑷𝑸𝑹𝑺𝑻𝑼𝑽𝑾𝑿𝒀𝒁",
    lower: "𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛",
  },
  mono: {
    upper: "𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉",
    lower: "𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣",
    digits: "𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿",
  },
  sans: {
    upper: "𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹",
    lower: "𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓",
    digits: "𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫",
  },
  sansBold: {
    upper: "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭",
    lower: "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇",
    digits: "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵",
  },
  sansItalic: {
    upper: "𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡",
    lower: "𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻",
  },
  sansBoldItalic: {
    upper: "𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕",
    lower: "𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯",
  },
  script: {
    upper: "𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵",
    lower: "𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏",
  },
  scriptBold: {
    upper: "𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩",
    lower: "𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃",
  },
  fraktur: {
    upper: "𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ",
    lower: "𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷",
  },
  frakturBold: {
    upper: "𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅",
    lower: "𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟",
  },
  doubleStruck: {
    upper: "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ",
    lower: "𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫",
  },
  circled: {
    upper: "ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ",
    lower: "ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ",
    digits: "⓪①②③④⑤⑥⑦⑧⑨",
  },
  squared: {
    upper: "🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉",
    lower: "",
    upperForLower: true,
  },
  squaredNegative: {
    upper: "🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩",
    lower: "",
    upperForLower: true,
  },
  parenthesized: {
    upper: "⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵",
    lower: "",
    upperForLower: true,
  },
  fullwidth: {
    upper: "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ",
    lower: "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ",
    digits: "０１２３４５６７８９",
  },
};

/** Convierte un texto a una tipografía Unicode (negrita, círculos, escritura a mano, etc.). */
export function toUnicodeStyle(text: string, style: UnicodeStyle): string {
  const font = UNICODE_STYLES[style];
  const upper = Array.from(font.upper);
  const lower = Array.from(font.lower);
  const digits = font.digits ? Array.from(font.digits) : undefined;
  return Array.from(text)
    .map((char) => {
      const cp = char.codePointAt(0)!;
      if (cp >= 0x41 && cp <= 0x5a) return upper[cp - 0x41];
      if (cp >= 0x61 && cp <= 0x7a) {
        return font.upperForLower ? upper[cp - 0x61] : lower[cp - 0x61];
      }
      if (cp >= 0x30 && cp <= 0x39 && digits) return digits[cp - 0x30];
      return char;
    })
    .join("");
}

/** Convierte de vuelta a texto plano las tipografías Unicode (quita negrita/círculos/etc.). */
export function cleanUnicodeStyle(text: string): string {
  const reverse = new Map<string, string>();
  const add = (styled: string, base: string) => {
    const chars = Array.from(styled);
    for (let i = 0; i < chars.length; i++) {
      const s = chars[i];
      const b = base[i];
      if (s && b && s !== b) reverse.set(s, b);
    }
  };
  for (const font of Object.values(UNICODE_STYLES)) {
    add(font.upper, LATIN_UPPER);
    if (!font.upperForLower) add(font.lower, LATIN_LOWER);
    if (font.digits) add(font.digits, LATIN_DIGITS);
  }
  return Array.from(text)
    .map((char) => reverse.get(char) ?? char)
    .join("");
}

/** Familia tipográfica: elegida de forma independiente al estilo. */
export type UnicodeFontFamily =
  | "normal"
  | "sans"
  | "mono"
  | "script"
  | "fraktur"
  | "doubleStruck"
  | "circled"
  | "squared"
  | "squaredNegative"
  | "parenthesized"
  | "sansBold"
  | "sansBoldItalic"
  | "scriptBold"
  | "fullwidth";

/** Estilo (peso/inclinación) aplicable a una familia. */
export type UnicodeFontStyle = "normal" | "bold" | "italic" | "boldItalic";

const FAMILY_STYLE_COMPOSITION: Record<
  UnicodeFontFamily,
  Partial<Record<UnicodeFontStyle, UnicodeStyle | null>>
> = {
  normal: { normal: null, bold: "bold", italic: "italic", boldItalic: "boldItalic" },
  sans: { normal: "sans", bold: "sansBold", italic: "sansItalic", boldItalic: "sansBoldItalic" },
  mono: { normal: "mono" },
  script: { normal: "script" },
  fraktur: { normal: "fraktur", bold: "frakturBold" },
  doubleStruck: { normal: "doubleStruck" },
  circled: { normal: "circled" },
  squared: { normal: "squared" },
  squaredNegative: { normal: "squaredNegative" },
  parenthesized: { normal: "parenthesized" },
  sansBold: { normal: "sansBold" },
  sansBoldItalic: { normal: "sansBoldItalic" },
  scriptBold: { normal: "scriptBold" },
  fullwidth: { normal: "fullwidth" },
};

/** Devuelve true si una familia soporta un estilo dado (ej. Círculos no tiene negrita). */
export function supportsUnicodeStyle(family: UnicodeFontFamily, style: UnicodeFontStyle): boolean {
  return style in FAMILY_STYLE_COMPOSITION[family];
}

/** Combina familia + estilo en el estilo Unicode concreto (null = texto plano). */
export function composeUnicodeStyle(
  family: UnicodeFontFamily,
  style: UnicodeFontStyle,
): UnicodeStyle | null {
  return FAMILY_STYLE_COMPOSITION[family][style] ?? null;
}
