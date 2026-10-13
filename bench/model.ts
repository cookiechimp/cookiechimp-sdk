export interface Sample {
  fixture: string;
  iteration: number;
  status: "passed" | "failed";
  error?: string;
  nativeEvidence?: Record<string, unknown>;
  lighthouseEvidence?: Record<string, unknown>;
  resourceEvidence?: { type: string; bytes: number; error?: string }[];
  jsGzipBytes: number | null;
  htmlGzipBytes: number | null;
  cssGzipBytes: number | null;
  lcpMs: number | null;
  cls: number | null;
  bannerVisibleMs: number | null;
  interactionMs: number | null;
  returningBannerVisible: boolean | null;
  lighthouseLcpMs: number | null;
  lighthouseCls: number | null;
  lighthouseTbtMs: number | null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  if (values.some((value) => !Number.isFinite(value)))
    throw new Error("Non-finite benchmark measurement");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export const metrics = [
  "jsGzipBytes",
  "htmlGzipBytes",
  "cssGzipBytes",
  "lcpMs",
  "cls",
  "bannerVisibleMs",
  "interactionMs",
  "lighthouseLcpMs",
  "lighthouseCls",
  "lighthouseTbtMs",
] as const;

export function summarize(samples: Sample[], expected: number) {
  const fixtures = [...new Set(samples.map((sample) => sample.fixture))];
  return fixtures.map((fixture) => {
    const rows = samples.filter((sample) => sample.fixture === fixture);
    const complete =
      rows.length === expected && rows.every((row) => row.status === "passed");
    const values = Object.fromEntries(
      metrics.map((metric) => {
        // A missing measurement never becomes a favourable zero or a reduced sample.
        const numbers = rows.map((row) => row[metric]);
        return [
          metric,
          complete && numbers.every((value) => value !== null)
            ? median(numbers as number[])
            : null,
        ];
      }),
    ) as Record<(typeof metrics)[number], number | null>;
    return {
      fixture,
      expected,
      attempts: rows.length,
      passed: rows.filter((row) => row.status === "passed").length,
      complete,
      medians: values,
    };
  });
}

export function renderReport(
  samples: Sample[],
  expected: number,
  metadata: Record<string, unknown>,
): string {
  const summaries = summarize(samples, expected);
  const baseline = summaries.find((row) => row.fixture === "baseline");
  const format = (value: number | null, decimals = 1) =>
    value === null ? "unavailable" : value.toFixed(decimals);
  return (
    `# CookieChimp SDK benchmark results\n\n` +
    `Recorded ${String(metadata.recordedAt)}. ${expected} measured runs per fixture. Excluded warmups per fixture: ${String(metadata.warmups)}. ` +
    `This is a local lab comparison of pinned versions, not field Core Web Vitals or a certification.\n\n` +
    `| Fixture | Passed | JS gzip bytes | JS overhead vs baseline | Native LCP ms | Native CLS | Banner observed ms | Consent interaction ms | Lighthouse LCP ms | Lighthouse CLS | Lighthouse TBT ms |\n` +
    `|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n` +
    summaries
      .map((row) => {
        const m = row.medians;
        const overhead =
          row.complete &&
          baseline?.complete &&
          m.jsGzipBytes !== null &&
          baseline.medians.jsGzipBytes !== null
            ? m.jsGzipBytes - baseline.medians.jsGzipBytes
            : null;
        return `| ${row.fixture} | ${row.passed}/${row.expected} | ${format(m.jsGzipBytes, 0)} | ${format(overhead, 0)} | ${format(m.lcpMs)} | ${format(m.cls, 4)} | ${format(m.bannerVisibleMs)} | ${format(m.interactionMs)} | ${format(m.lighthouseLcpMs)} | ${format(m.lighthouseCls, 4)} | ${format(m.lighthouseTbtMs)} |`;
      })
      .join("\n") +
    `\n\nJavaScript bytes are the sum of gzip -9 response bodies fetched during the fresh-load observation window; ` +
    `HTML and CSS bytes are retained separately in raw samples. CookieChimp's server cookie seed is included in HTML. ` +
    `Subtracted medians are descriptive differences, not statistical evidence of superiority.\n\n` +
    `The native interaction column is the longest Event Timing duration among the exercised consent and page actions. ` +
    `It is not field INP. Missing browser timing stays unavailable. Banner timing observes layout visibility, not painted pixels or interactivity. ` +
    `Returning visitors are prepared by a real accept action and reloaded to verify the choice persists.\n\n` +
    `See [methodology](../README.md) and the adjacent raw JSON for browser, host, dependency, throttle and source provenance. ` +
    `Failed attempts are retained. A missing or failed sample withholds medians for that fixture.\n`
  );
}
