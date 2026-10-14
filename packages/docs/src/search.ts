export interface SearchEntry {
  title: string;
  url: string;
  text: string;
}
export interface SearchResult extends SearchEntry {
  score: number;
  snippet: string;
}

const normalize = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase("en");

/** Keep generated links relative to HTML pages, even if an index is malformed. */
export function parseIndex(value: unknown): SearchEntry[] {
  if (!Array.isArray(value)) throw new Error("Invalid search index");
  return value.filter(
    (entry): entry is SearchEntry =>
      !!entry &&
      typeof entry === "object" &&
      typeof entry.title === "string" &&
      typeof entry.text === "string" &&
      typeof entry.url === "string" &&
      /^[a-z0-9-]+\.html(?:#[\p{L}\p{N}-]+)?$/u.test(entry.url),
  );
}

export function search(
  index: readonly SearchEntry[],
  query: string,
): SearchResult[] {
  const terms = [
    ...new Set(
      normalize(query.slice(0, 200)).trim().split(/\s+/).filter(Boolean),
    ),
  ].slice(0, 12);
  if (!terms.length) return [];
  const results: SearchResult[] = [];
  for (const entry of index) {
    const title = normalize(entry.title);
    const text = normalize(entry.text);
    if (!terms.every((term) => title.includes(term) || text.includes(term)))
      continue;
    const score = terms.reduce(
      (sum, term) => sum + (title.includes(term) ? 10 : 1),
      0,
    );
    const at = Math.max(0, text.indexOf(terms[0] ?? ""));
    const start = Math.max(0, at - 60);
    const snippet = `${start ? "…" : ""}${entry.text.slice(start, start + 230)}${entry.text.length > start + 230 ? "…" : ""}`;
    results.push({ ...entry, score, snippet });
  }
  return results.sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title, "en"),
  );
}

export async function mountSearch(root: HTMLElement): Promise<void> {
  const input = root.querySelector<HTMLInputElement>("input[type=search]");
  const form = root.querySelector<HTMLFormElement>("form");
  const status = root.querySelector<HTMLElement>("[role=status]");
  const list = root.querySelector<HTMLOListElement>("ol");
  if (!input || !form || !status || !list) return;
  input.value =
    new URL(location.href).searchParams.get("q")?.slice(0, 200) ?? "";
  try {
    const response = await fetch("search-index.json", {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Search index unavailable");
    const index = parseIndex(await response.json());
    const render = () => {
      const results = search(index, input.value);
      status.textContent = !input.value.trim()
        ? "Enter a word or phrase to search."
        : results.length
          ? `${results.length} ${results.length === 1 ? "result" : "results"}${results.length > 30 ? "; showing the first 30" : ""}.`
          : "No matching sections. Try a different word.";
      list.replaceChildren();
      for (const result of results.slice(0, 30)) {
        const row = document.createElement("li");
        const link = document.createElement("a");
        link.href = result.url;
        link.textContent = result.title;
        const excerpt = document.createElement("p");
        excerpt.textContent = result.snippet;
        row.append(link, excerpt);
        list.append(row);
      }
      const url = new URL(location.href);
      if (input.value.trim())
        url.searchParams.set("q", input.value.slice(0, 200));
      else url.searchParams.delete("q");
      history.replaceState(null, "", url);
    };
    input.disabled = false;
    form
      .querySelector<HTMLButtonElement>("button")
      ?.removeAttribute("disabled");
    input.addEventListener("input", render);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });
    render();
  } catch {
    status.textContent =
      "Search could not load. Reload to retry, or browse the documentation using the links.";
  }
}

if (typeof document !== "undefined") {
  const root = document.getElementById("docs-search");
  if (root) void mountSearch(root);
}
