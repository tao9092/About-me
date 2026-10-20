// Where browsers report Content-Security-Policy violations (next.config.ts).
// Each report is logged, trimmed to the fields that say what was blocked and
// where, so the policy can be checked in the deployment logs before it is
// enforced. Anyone can post here, so the body is capped and never echoed back.
const MAX_BYTES = 8 * 1024;

type Report = Record<string, unknown>;
const pick = (report: Report) => ({
  page: report["document-uri"] ?? report.documentURL,
  directive: report["effective-directive"] ?? report.effectiveDirective ?? report["violated-directive"],
  blocked: report["blocked-uri"] ?? report.blockedURL,
  source: report["source-file"] ?? report.sourceFile,
  line: report["line-number"] ?? report.lineNumber,
  sample: report["script-sample"] ?? report.sample,
});

export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BYTES) return new Response(null, { status: 204 });
  try {
    const body = JSON.parse(text) as unknown;
    // report-uri sends { "csp-report": {...} }; the Reporting API sends [{ type, body }].
    const reports = Array.isArray(body)
      ? body.filter((entry) => entry?.type === "csp-violation").map((entry) => entry.body as Report)
      : [((body as Report)["csp-report"] ?? body) as Report];
    for (const report of reports.slice(0, 10)) console.warn("[csp]", JSON.stringify(pick(report)));
  } catch {
    // Not a report: ignore it.
  }
  return new Response(null, { status: 204 });
}
