/**
 * Deterministic checks for local citation FP gates + local-only filtering.
 * Run: node --experimental-strip-types --import ./server/parl-ts-register.mjs scripts/test-local-evidence.mjs
 */
import assert from "node:assert/strict";
import {
  attachCitationPassages,
  findSupportingPassages,
} from "../lib/evidence/citations.ts";
import {
  FIXTURE_CITED_BASE,
  FIXTURE_EVIDENCE,
  FIXTURE_QUESTION,
} from "../lib/mock/local-evidence-fixture.ts";

function main() {
  const capture = FIXTURE_EVIDENCE[0];
  const hits = findSupportingPassages(capture.text, FIXTURE_QUESTION, {
    max: 2,
    windowChars: 280,
    title: capture.title,
  });
  assert.ok(hits.length >= 1, "expected grounded passages for capture fixture");
  assert.ok(hits[0].score >= 0.38, "passage score below quality floor");

  const noise = findSupportingPassages(
    capture.text,
    "banana pineapple tourism cruise itinerary unrelated",
    { max: 2, title: capture.title }
  );
  assert.equal(noise.length, 0, "false-positive query should yield no passages");

  const openMode = attachCitationPassages(
    FIXTURE_CITED_BASE,
    FIXTURE_EVIDENCE,
    [FIXTURE_QUESTION, "electricity tariff reform industrial competitiveness"],
    { localOnly: false }
  );
  assert.ok(
    openMode.some((s) => s.id === "src_registry_only"),
    "open mode keeps registry-only rows"
  );
  assert.ok(
    (openMode.find((s) => s.id === "src_capture_fixture")?.passageCount || 0) >= 1,
    "capture cite must have accepted passages"
  );

  const localOnly = attachCitationPassages(
    FIXTURE_CITED_BASE,
    FIXTURE_EVIDENCE,
    [FIXTURE_QUESTION, "electricity tariff reform industrial competitiveness"],
    { localOnly: true, requirePassages: true }
  );
  assert.ok(
    localOnly.every((s) => (s.passageCount || 0) >= 1),
    "local-only mode requires ≥1 accepted passage"
  );
  assert.ok(
    !localOnly.some((s) => s.id === "src_registry_only"),
    "local-only drops registry-only stub without text"
  );
  assert.ok(
    localOnly.some((s) => s.id === "src_capture_fixture"),
    "local-only keeps capture source"
  );
  assert.ok(
    localOnly.some((s) => s.id === "parl_vimeo_999001"),
    "local-only keeps parl transcript source"
  );

  console.log("ok — local evidence citation fixture assertions passed");
  console.log(
    JSON.stringify(
      {
        openCount: openMode.length,
        localOnlyCount: localOnly.length,
        localIds: localOnly.map((s) => s.id),
        passageFloors: Object.fromEntries(
          localOnly.map((s) => [s.id, s.passageCount || 0])
        ),
      },
      null,
      2
    )
  );
}

main();
