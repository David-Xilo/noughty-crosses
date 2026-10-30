// Localization (GDD §10, TTT-4.1.8): every string the player reads is a Fluent message in
// src/ui/locales/. English ships alone, and the language follows the browser or the OS
// (decision P9). `?lang=en-XA` shows the pseudo-locale: English with accented letters and
// doubled vowels, about 30% longer, to find clipped text and strings that skip Fluent.
import { FluentBundle, FluentResource, type FluentVariable } from "@fluent/bundle";
import en from "./locales/en.ftl?raw";

const PSEUDO = "en-XA";
const LOCALES: Record<string, string> = { en };

const PLAIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ACCENTED = [..."ȦƁƇḒḖƑƓĦĪĴĶĿḾȠǾƤɊŘŞŦŬṼẆẊẎẐȧƀƈḓḗƒɠħīĵķŀḿƞǿƥɋřşŧŭṽẇẋẏẑ"];
/** Pseudo-localizes a message's own text; the values put into it are left alone. */
const pseudo = (text: string) =>
  text.replace(/[A-Za-z]/g, (c) => {
    const a = ACCENTED[PLAIN.indexOf(c)] as string;
    return "aeiouAEIOU".includes(c) ? a + a : a;
  });

function bundleFor(lang: string): FluentBundle {
  const b = new FluentBundle(lang, {
    // No right-to-left text is planned (§10): no isolation marks around values.
    useIsolating: false,
    ...(lang === PSEUDO ? { transform: pseudo } : {}),
  });
  const errors = b.addResource(
    new FluentResource(Object.hasOwn(LOCALES, lang) ? (LOCALES[lang] as string) : en),
  );
  for (const e of errors) console.error("l10n:", e);
  return b;
}

/** `?lang=en-XA`, else the first of the browser's languages that ships, else English. */
export function chooseLanguage(url: URL, preferred: readonly string[]): string {
  if (url.searchParams.get("lang") === PSEUDO) return PSEUDO;
  const ships = (l: string) => Object.hasOwn(LOCALES, l);
  return preferred.map((l) => l.split("-")[0] as string).find(ships) ?? "en";
}

let bundle = bundleFor("en");

export function setLanguage(lang: string) {
  bundle = bundleFor(lang);
}

type Args = Record<string, FluentVariable>;

/** A message's text; a missing message shows its ID, so the pseudo-locale check finds it. */
export function t(id: string, args?: Args): string {
  const m = bundle.getMessage(id);
  if (!m?.value) {
    console.error(`l10n: no message ${id}`);
    return id;
  }
  return bundle.formatPattern(m.value, args);
}

/** Sets an element's text and attributes from its message; `args` fill the values. */
export function setL10n(el: Element, id: string, args?: Args) {
  const m = bundle.getMessage(id);
  if (!m) {
    console.error(`l10n: no message ${id}`);
    el.textContent = id;
    return;
  }
  if (m.value) el.textContent = bundle.formatPattern(m.value, args);
  for (const [name, p] of Object.entries(m.attributes))
    el.setAttribute(name, bundle.formatPattern(p, args));
}

/** Translates every element under `root` that names its message in `data-l10n-id`. */
export function localize(root: ParentNode) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-l10n-id]"))
    setL10n(el, el.dataset.l10nId as string);
}
