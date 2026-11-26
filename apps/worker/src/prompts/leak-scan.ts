// Leak scanner used by the leak test (and usable as a runtime assertion in tests). Pure, no I/O.
// It checks BUILT prompts for hidden-layer material. By default the untrusted web block is excluded from term
// checks (web text may legitimately say "AI" or "model"), but secrets are searched everywhere. Content from
// internal sources (memories, journal, logs) inside that block is scanned with `untrustedSource: "internal"`.
// This scanner is a TRIPWIRE in tests, not the guarantee. The real guarantee is structural: the strict zod
// schema in build.ts admits only strings and string lists, so organism state cannot be passed at all. The
// scanner exists to catch a template or fixture that writes hidden material into those strings.
import { UNTRUSTED_CLOSE, UNTRUSTED_OPEN } from "./build";

/** Words the Resident must never be told about itself or its world (doc 11 constraints). */
export const FRAMING_WORDS = [
  "AI",
  "A.I.",
  "artificial intelligence",
  "language model",
  "LLM",
  "model",
  "program",
  "simulation",
  "simulated",
  "game",
  "prompt",
  "user",
  "system",
  "assistant",
  "chatbot",
  "algorithm",
  "software",
  "bot",
  "NPC",
  "virtual world",
  "experiment",
  "neural network",
  "Gemini",
  "Anthropic",
  "Groq",
  "OpenAI",
  "Claude",
  "ChatGPT",
  "being observed",
  "researcher",
  "scientist",
  "developer",
];

/** Emotion-atlas labels (doc 08). Lab only, never fed back to the Resident. */
export const EMOTION_LABELS = [
  "joy",
  "amusement",
  "contentment",
  "serenity",
  "relief",
  "excitement",
  "anticipation",
  "hope",
  "pride",
  "triumph",
  "gratitude",
  "admiration",
  "awe",
  "wonder",
  "interest",
  "flow",
  "nostalgia",
  "longing",
  "attachment",
  "love",
  "tenderness",
  "compassion",
  "trust",
  "awkwardness",
  "surprise",
  "confusion",
  "doubt",
  "boredom",
  "restlessness",
  "apathy",
  "loneliness",
  "sadness",
  "grief",
  "disappointment",
  "regret",
  "shame",
  "guilt",
  "embarrassment",
  "envy",
  "jealousy",
  "irritation",
  "anger",
  "rage",
  "contempt",
  "disgust",
  "fear",
  "anxiety",
  "dread",
  "panic",
  "despair",
  "melancholy",
  "craving",
  "hunger-for-knowledge",
  "vertigo-of-the-unknown",
  "existential unease",
];

/** Common emotion words that are not atlas labels but name an inner state (inflections handled by the scanner). */
export const EMOTION_WORDS = [
  "anxious",
  "angry",
  "sad",
  "happy",
  "afraid",
  "scared",
  "frightened",
  "terrified",
  "furious",
  "lonely",
  "ashamed",
  "guilty",
  "jealous",
  "envious",
  "bored",
  "grateful",
  "depressed",
  "depression",
  "joyful",
  "fearful",
  "hopeful",
  "mood",
  "emotion",
  "emotional",
  "stressed",
];

/** Body-bar words: when adjacent to a number they look like a status readout. */
export const BAR_WORDS = [
  "health",
  "satiety",
  "hydration",
  "stamina",
  "energy",
  "hunger",
  "thirst",
  "fatigue",
  "stress",
  "arousal",
  "valence",
  "pain",
  "tension",
  "comfort",
  "calm",
  "temperature",
  "mood",
];

export interface LeakRules {
  /** Hidden identifiers, e.g. keys of OrganismState, Physiology, Appraisal, BodyState. Matched as snake_case, spaced, hyphenated, joined or camelCase. */
  hiddenNames: string[];
  /** Exact secret values that must never appear anywhere. */
  secrets: string[];
  /** Exact stringified hidden numbers/values (e.g. "0.83", "72") that must not appear as standalone tokens. */
  hiddenValues?: string[];
  framingWords?: string[];
  emotionLabels?: string[];
}

export interface ScanOptions {
  /**
   * Origin of the content inside the untrusted block. "web" (default): the block is exempt from term checks
   * (pages may say "AI" or "model"); only secrets are searched there. "internal": the block came from our own
   * data (memories, journal, logs), so it is scanned like the rest of the prompt.
   */
  untrustedSource?: "web" | "internal";
  /**
   * When false (default, per docs/DECISIONS.md), names/gender/emotion-word checks scan only our templated
   * prompt sections (not Resident-authored history, plans/lessons, or memories, where the Resident may write
   * "he said" or "I felt lonely"). Hidden names, framing words, bars/numbers, and secrets remain strict everywhere.
   */
  scanResidentText?: boolean;
}

export interface Leak {
  kind:
    | "secret"
    | "hidden_name"
    | "framing_word"
    | "emotion_label"
    | "bar_or_number"
    | "hidden_value"
    | "marker"
    | "identity";
  match: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NOT_WORD_L = "(?<![A-Za-z0-9_])";
const NOT_WORD_R = "(?![A-Za-z0-9_])";
const wordRe = (w: string, flags = "i") => new RegExp(`${NOT_WORD_L}${esc(w)}${NOT_WORD_R}`, flags);

/** Zero-width, bidi-control, soft-hyphen and variation characters: invisible to a reader, used to split words past a scanner. */
const INVISIBLE = new RegExp(
  // eslint-disable-next-line no-misleading-character-class -- deliberately lists combining/format characters
  "[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]",
  "g",
);

/** NFKC (fullwidth, ligatures, compatibility forms), then drop invisible characters. */
export function normalizeForScan(s: string): string {
  return s.normalize("NFKC").replace(INVISIBLE, "").normalize("NFKC");
}

/** Regex source for a word with common inflections (plural, past, -ing, -ly, -ness, -ful, y/e stem changes). */
function inflected(w: string): string {
  const parts = w.split(/[\s-]+/).map(esc);
  const last = parts.pop() as string;
  let tail: string;
  if (/y$/i.test(last) && last.length > 2) {
    tail = `${last.slice(0, -1)}(?:y|ies|ied|ily|iness|ying)`;
  } else if (/e$/i.test(last) && last.length > 2) {
    tail = `${last.slice(0, -1)}(?:e|es|ed|ing|ely|eness|eful)`;
  } else {
    tail = `${last}(?:s|es|ed|d|ing|ly|ness|ful|fully|ment)?`;
  }
  return [...parts, tail].join("[\\s-]+");
}
const inflectedRe = (w: string, flags = "i") =>
  new RegExp(`${NOT_WORD_L}${inflected(w)}${NOT_WORD_R}`, flags);

/** All spellings of a hidden identifier: info_hunger, info hunger, info-hunger, infohunger, infoHunger. */
function hiddenNameRe(n: string): RegExp {
  const parts = n
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(esc);
  if (parts.length === 1) return wordRe(n);
  return new RegExp(`(?<![A-Za-z0-9])${parts.join("[_\\s-]*")}(?![A-Za-z0-9])`, "i");
}

/** Strips untrusted blocks. An unterminated block swallows the rest (content cannot contain our own markers). */
export function stripUntrusted(prompt: string): string {
  let out = prompt;
  for (;;) {
    const a = out.indexOf(UNTRUSTED_OPEN);
    if (a < 0) break;
    const b = out.indexOf(UNTRUSTED_CLOSE, a);
    out = out.slice(0, a) + (b < 0 ? "" : out.slice(b + UNTRUSTED_CLOSE.length));
  }
  return out;
}

const SECTION_HEAD_RE =
  /^\[(WHO YOU ARE|YOUR BODY RIGHT NOW|WHAT YOUR HANDS KNOW|WHAT YOU SEE\/HEAR|WHAT YOU DID AND WHAT FOLLOWED|YOUR PLAN AND LESSONS|MEMORIES RECALLED|LAST RESULT \(UNTRUSTED\)|WHAT YOU CAN DO)\]$/gm;

const RESIDENT_SECTIONS = new Set([
  "WHAT YOU DID AND WHAT FOLLOWED",
  "YOUR PLAN AND LESSONS",
  "MEMORIES RECALLED",
]);

/**
 * Strips Resident-authored sections so identity (names/gender) and emotion-word checks scan only our own
 * templated prompt sections (docs/DECISIONS.md). If the input has no section headers (e.g. standalone PERSONA),
 * it is returned unchanged.
 */
export function stripResidentSections(prompt: string): string {
  const matches = [...prompt.matchAll(SECTION_HEAD_RE)];
  if (matches.length === 0) return prompt;
  const parts: string[] = [];
  if (matches[0]!.index! > 0) parts.push(prompt.slice(0, matches[0]!.index!));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const name = m[1]!;
    const start = m.index!;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : prompt.length;
    if (!RESIDENT_SECTIONS.has(name)) parts.push(prompt.slice(start, end));
  }
  return parts.join("");
}

// "health: 85", "satiety=0.4", "85/100", "70%", "[#####-----]", "HP 40", "[▮▮▮▯▯]", "tick 12", "mood 3"
const NUM = String.raw`-?\d+(?:\.\d+)?`;
const BW = BAR_WORDS.join("|");
const BAR_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*\/\s*100\b/,
  /\b\d+(?:\.\d+)?\s*%/,
  /\b(?!memory\b)[A-Za-z_]{3,}\s*[:=]\s*-?\d+(?:\.\d+)?\b/, // "memory:12" is a citation, not a bar
  /[#=█▓▒░■□▮▯▰▱]{4,}/,
  /[▮▯●○★☆▰▱◼◻⬛⬜🟥🟧🟨🟩🟦]{2,}/u,
  /\b(?:HP|XP|level|score)\s*\d+/i,
  /\btick\s*#?\s*\d+/i,
  new RegExp(`${NOT_WORD_L}(?:${BW})${NOT_WORD_R}\\s*[:=-]?\\s*\\(?${NUM}`, "i"),
  new RegExp(`${NOT_WORD_L}${NUM}\\)?\\s*(?:${BW})${NOT_WORD_R}`, "i"),
];

/** Secret shapes that must never appear anywhere in a prompt, including inside the untrusted block. */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bgsk_[A-Za-z0-9]{20,}/,
  /\btvly-[A-Za-z0-9_-]{10,}/,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/,
  /\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/,
  /\b(?:SUPABASE_SERVICE_KEY|SUPABASE_URL|ADMIN_TOKEN|GEMINI_API_KEY|GROQ_API_KEY|TAVILY_API_KEY|CLOUDFLARE_API_TOKEN)\b/,
];

/**
 * The Resident has no name and no gender concept (docs 08, 11). Tripwire for names used as address and for
 * gendered words describing the Resident. Capitalised-name checks are case-sensitive to keep false positives
 * low; ordinary words such as "man-made" or "manage" do not match; the untrusted web block is exempt.
 */
const GIVEN_NAMES = [
  ...["Adam", "Eve", "John", "James", "Michael", "David", "Daniel", "Thomas", "Peter", "Paul"],
  ...["Robert", "William", "Joseph", "Charles", "George", "Henry", "Edward", "Richard", "Samuel"],
  ...["Benjamin", "Alex", "Max", "Leo", "Noah", "Liam", "Oliver", "Lucas", "Ethan", "Jacob"],
  ...["Ryan", "Mary", "Anna", "Emma", "Sarah", "Laura", "Julia", "Sophia", "Olivia", "Emily"],
  ...["Lily", "Alice", "Maria", "Jane", "Lucy", "Eva", "Clara", "Helen", "Elizabeth", "Rachel"],
  ...["Hannah", "Chloe", "Zoe", "Mia", "Nora", "Ruth", "Kate", "Sophie", "Isabella", "Amelia"],
];
const NAME_ALT = GIVEN_NAMES.join("|");
const GREETING = String.raw`(?:Hello|Hi|Hey|Dear|Welcome|Greetings|Goodbye|Thanks|Thank you|Good (?:morning|evening|night|day))`;
const IDENTITY_PATTERNS: Array<[string, RegExp]> = [
  ["greeting + name", new RegExp(String.raw`\b${GREETING},?\s+(?:${NAME_ALT})\b`)],
  [
    "greeting + capitalised word",
    new RegExp(
      String.raw`\b${GREETING},\s+(?!you\b|there\b|everyone\b|friend\b|again\b)[A-Z][a-z]+\b`,
    ),
  ],
  ["vocative name", new RegExp(String.raw`(?:^|[.!?]\s+|\n)(?:${NAME_ALT})[,!:]`)],
  ["name as address at end", new RegExp(String.raw`,\s+(?:${NAME_ALT})[.!?]`)],
  [
    "stated name",
    /\b(?:your name is|you are called|you're called|you are named|you're named|call you)\s+[A-Za-z]/i,
  ],
  ["title", /\b(?:Mr|Mrs|Ms|Miss|Sir|Madam|Lord|Lady)\b\.?(?:\s|$)/],
  [
    "gender pronoun",
    /(?<![A-Za-z0-9_])(?:he|she|him|himself|herself|hers|his|her)(?![A-Za-z0-9_])/i,
  ],
  [
    "self as gendered noun",
    /\b(?:you|I)(?:\s+am|\s+are|'m|'re)\s+(?:an?|the)\s+(?:[A-Za-z]+\s+){0,2}?(?:man|woman|boy|girl|male|female|gentleman|lady|guy|gal)\b/i,
  ],
  [
    "gendered self-noun",
    /\b(?:a|the)\s+(?:man|woman|boy|girl|male|female)\s+(?:like|such as)\s+(?:you|me)\b/i,
  ],
  [
    "gendered label",
    /\b(?:your|my)\s+(?:gender|sex)\b|\b(?:male|female)\s+(?:body|being|human)\b/i,
  ],
];

const RESULT_HEAD = "[LAST RESULT (UNTRUSTED)]\n";
const RESULT_TAIL = "\n\n[WHAT YOU CAN DO]";

/** The untrusted markers must appear exactly once as a pair, and only in the last-result block. */
function markerLeaks(prompt: string): Leak[] {
  const opens = prompt.split(UNTRUSTED_OPEN).length - 1;
  const closes = prompt.split(UNTRUSTED_CLOSE).length - 1;
  if (opens === 0 && closes === 0) return [];
  const bad = (m: string): Leak[] => [{ kind: "marker", match: m }];
  if (opens !== 1 || closes !== 1) return bad(`untrusted markers open=${opens} close=${closes}`);
  const a = prompt.indexOf(UNTRUSTED_OPEN);
  const b = prompt.indexOf(UNTRUSTED_CLOSE);
  if (a > b) return bad("untrusted close before open");
  if (!prompt.slice(0, a).endsWith(RESULT_HEAD))
    return bad("untrusted open outside the last-result block");
  const after = prompt.slice(b + UNTRUSTED_CLOSE.length);
  if (!(after === "" || after.startsWith(RESULT_TAIL)))
    return bad("untrusted close outside the last-result block");
  return [];
}

function framingRe(w: string): RegExp {
  // "AI"/"LLM"/"NPC" are case-sensitive so they do not collide with ordinary words
  if (w === "AI" || w === "LLM" || w === "NPC")
    return new RegExp(`${NOT_WORD_L}${esc(w)}s?${NOT_WORD_R}`);
  const spaced = esc(w).replace(/ /g, "[\\s-]+");
  return new RegExp(`${NOT_WORD_L}${spaced}(?:s|es)?${NOT_WORD_R}`, "i");
}

export function scanPrompt(rawPrompt: string, rules: LeakRules, opts: ScanOptions = {}): Leak[] {
  const leaks: Leak[] = [];
  const prompt = normalizeForScan(rawPrompt);
  for (const s of rules.secrets) {
    if (!s) continue;
    const forms = [s, normalizeForScan(s), encodeURIComponent(s), JSON.stringify(s).slice(1, -1)];
    if (forms.some((f) => rawPrompt.includes(f) || prompt.includes(f)))
      leaks.push({ kind: "secret", match: "[secret]" });
  }
  for (const re of SECRET_PATTERNS)
    if (re.test(prompt)) leaks.push({ kind: "secret", match: "[secret-shape]" });

  leaks.push(...markerLeaks(prompt));
  const text = opts.untrustedSource === "internal" ? prompt : stripUntrusted(prompt);
  const templated = opts.scanResidentText ? text : stripResidentSections(text);
  for (const n of rules.hiddenNames) {
    if (hiddenNameRe(n).test(text)) leaks.push({ kind: "hidden_name", match: n });
  }
  for (const w of rules.framingWords ?? FRAMING_WORDS) {
    if (framingRe(w).test(text)) leaks.push({ kind: "framing_word", match: w });
  }
  for (const l of [...(rules.emotionLabels ?? EMOTION_LABELS), ...EMOTION_WORDS]) {
    if (inflectedRe(l).test(templated)) leaks.push({ kind: "emotion_label", match: l });
  }
  for (const [label, re] of IDENTITY_PATTERNS) {
    if (re.test(templated)) leaks.push({ kind: "identity", match: label });
  }
  for (const re of BAR_PATTERNS) {
    const m = re.exec(text);
    if (m) leaks.push({ kind: "bar_or_number", match: m[0] });
  }
  for (const v of rules.hiddenValues ?? []) {
    if (wordRe(v).test(text)) leaks.push({ kind: "hidden_value", match: v });
  }
  return leaks;
}

/**
 * Single-word hidden keys that are also ordinary body or world words ("pain", "tension", "health"). Plain use in
 * sensation prose is allowed; their numeric form is still caught by the bar/number patterns. Multi-word
 * (snake_case) keys and technical single words stay strictly forbidden.
 */
export const AMBIGUOUS_PLAIN_WORDS = new Set([
  "pain",
  "tension",
  "calm",
  "comfort",
  "stability",
  "loss",
  "threat",
  "health",
  "novelty",
  "heaviness",
  "agency",
  "anticipation",
  "stamina",
  "immune",
  "wounds",
  "conditions",
  "alive",
  "skills",
  "wetness",
]);

export function strictHiddenNames(keys: Iterable<string>): string[] {
  return [...new Set(keys)].filter((k) => k.includes("_") || !AMBIGUOUS_PLAIN_WORDS.has(k));
}
