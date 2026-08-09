import { NextRequest, NextResponse } from "next/server";
import { resolveCatalog } from "@/lib/i18n/translate-service";
import { TRANSLATE_LANGUAGES } from "@/lib/i18n/languages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(TRANSLATE_LANGUAGES.map((l) => l.value));

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") || "en";
  if (!ALLOWED.has(locale) && locale !== "en") {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  try {
    const result = await resolveCatalog(locale);
    const res = NextResponse.json({
      locale: result.locale,
      messages: result.messages,
      meta: {
        cached: result.cached,
        translatedKeys: result.translatedKeys,
        catalogVersion: result.catalogVersion,
        coverage: result.coverage,
        generatedAt: new Date().toISOString(),
      },
    });
    // Permanent catalogs — browsers/CDN can reuse until version changes.
    res.headers.set(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=600"
    );
    res.headers.set("ETag", `"i18n-${result.locale}-${result.catalogVersion}"`);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Catalog failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
