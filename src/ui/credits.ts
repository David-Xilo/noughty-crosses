// The Credits card (GDD §6), read from CREDITS.md when the game is built, so the asset
// register stays the one place credits are written. The rows are shown as written there.
import register from "../../CREDITS.md?raw";
import { t } from "./l10n";

/** Markdown inline code and links as plain text. */
const plain = (s: string) =>
  s
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();

/** The rows of the first table under a `## heading`, as cells by column name. */
function table(heading: string): Record<string, string>[] {
  const section = register.split(/^## /m).find((s) => s.startsWith(heading)) ?? "";
  const rows = section
    .split("\n")
    .filter((l) => l.startsWith("|"))
    .map((l) => l.slice(1, -1).split("|").map(plain));
  const [head, , ...body] = rows;
  return body.map((r) => Object.fromEntries((head ?? []).map((h, i) => [h, r[i] ?? ""])));
}

function list(title: string, items: string[]): HTMLElement {
  const section = document.createElement("section");
  const h = section.appendChild(document.createElement("h3"));
  h.textContent = title;
  const ul = section.appendChild(document.createElement("ul"));
  for (const text of items) ul.appendChild(document.createElement("li")).textContent = text;
  return section;
}

export function renderCredits(root: HTMLElement): void {
  const people = (register.split(/^## /m).find((s) => s.startsWith("People")) ?? "")
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => plain(l.slice(2)));
  const assets = table("Assets").map(
    (r) =>
      `${r["Asset (path)"]}: ${r.Author}, ${r.Licence}${r["Source URL"] && r["Source URL"] !== "—" ? ` (${r["Source URL"]})` : ""}`,
  );
  const code = table("Third-party code").map(
    (r) => `${r.Library} ${r.Version}: ${r.Licence}, ${r["Used for"]}`,
  );
  const version = document.createElement("p");
  version.className = "credits-version";
  version.textContent = t("credits-version", { version: __APP_VERSION__ });
  const notices = document.createElement("p");
  const a = notices.appendChild(document.createElement("a"));
  a.href = `${import.meta.env.BASE_URL}THIRD-PARTY-NOTICES.txt`;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = t("credits-notices");
  root.replaceChildren(
    version,
    list(t("credits-people"), people),
    list(t("credits-assets"), assets),
    list(t("credits-code"), code),
    notices,
  );
}
