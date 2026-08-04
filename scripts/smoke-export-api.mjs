import fs from "fs";

const key = "change-me-to-a-long-random-secret";
const briefs = JSON.parse(fs.readFileSync("data/local/briefs.json", "utf8"));
const a = briefs.find((b) => b.country === "Barbados") || briefs[0];
const b = briefs.find((b) => b.country === "Guyana" && b.id !== a.id) || briefs[1];

async function exportOne(brief, format) {
  const res = await fetch(`http://127.0.0.1:4000/api/briefs/${brief.id}/export`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateId: "tpl_octivate_brief",
      format,
      mock: false,
    }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = format === "html" ? buf.toString("utf8") : "";
  const okHttp = res.ok;
  const hasTitle = format === "html" ? text.includes(brief.title) : buf.length > 1000;
  const hasCountry = format === "html" ? text.includes(brief.country) : true;
  const bleed =
    format === "html" &&
    brief.country !== "Guyana" &&
    text.includes("Guyana Midstream LNG");
  const leftover = format === "html" && text.includes("{{brief.");
  console.log(
    JSON.stringify({
      id: brief.id,
      country: brief.country,
      format,
      status: res.status,
      bytes: buf.length,
      hasTitle,
      hasCountry,
      bleed,
      leftover,
      ok: okHttp && hasTitle && hasCountry && !bleed && !leftover,
    })
  );
}

for (const brief of [a, b]) {
  await exportOne(brief, "html");
  await exportOne(brief, "pdf");
}
