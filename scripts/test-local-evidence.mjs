/**
 * Deterministic checks for map-reduce chunking + document evidence bundle.
 * Run: npm run test:local-evidence
 */
import assert from "node:assert/strict";
import {
  attachCitationPassages,
  findSupportingPassages,
} from "../lib/evidence/citations.ts";
import { chunkDocumentText, selectChunksForMap } from "../lib/docs/chunk.ts";
import {
  FIXTURE_CITED_BASE,
  FIXTURE_EVIDENCE,
  FIXTURE_PROJECT,
  FIXTURE_QUESTION,
} from "../lib/mock/local-evidence-fixture.ts";

function testCitations() {
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

  console.log("ok — citation fixture");
  return { openCount: openMode.length, localOnlyCount: localOnly.length };
}

function testChunkMapReduce() {
  const long = Array.from({ length: 40 }, (_, i) => {
    if (i % 7 === 0) {
      return `Section ${i}: electricity tariff reform will affect industrial competitiveness in Barbados through staged peak rates.`;
    }
    return `Section ${i}: filler administrative language about reporting calendars and office procedures unrelated to the decision.`;
  }).join(" ");

  const chunks = chunkDocumentText(long, {
    chunkChars: 500,
    overlapChars: 80,
    question: FIXTURE_QUESTION,
    maxChunks: 20,
  });
  assert.ok(chunks.length > 3, "expected multiple chunks for high-volume text");
  assert.ok(
    chunks.some((c) => c.questionScore > 0),
    "at least one chunk should score against the decision question"
  );

  const selected = selectChunksForMap(chunks, 4);
  assert.equal(selected.length, 4, "map selection should respect limit");
  const avgSelected =
    selected.reduce((a, c) => a + c.questionScore, 0) / selected.length;
  const avgAll = chunks.reduce((a, c) => a + c.questionScore, 0) / chunks.length;
  assert.ok(
    avgSelected >= avgAll,
    "selected map chunks should be at least as question-relevant as the average"
  );

  console.log("ok — map-reduce chunking");
  return { chunkCount: chunks.length, mapCount: selected.length, avgSelected };
}

function testBundleShape() {
  // Deterministic in-memory bundle shape (no disk extract) using fixture project meta.
  const docs = FIXTURE_PROJECT.documents || [];
  assert.ok(docs.length >= 1, "fixture project should include an upload slot");

  // Simulate structured_merge fields the pipeline expects
  const theatreBrief = [
    `Document evidence bundle for decision: ${FIXTURE_QUESTION}`,
    `Theatre: ${FIXTURE_PROJECT.name} · ${FIXTURE_PROJECT.country} · ${FIXTURE_PROJECT.sector}`,
    "### Doc 1 upload",
    FIXTURE_EVIDENCE[2].text,
  ].join("\n");

  assert.ok(theatreBrief.includes("electricity tariff"), "bundle retains question context");
  assert.ok(theatreBrief.includes(FIXTURE_PROJECT.country), "bundle retains theatre");

  console.log("ok — document bundle shape");
  return { briefChars: theatreBrief.length };
}

function main() {
  const citations = testCitations();
  const chunks = testChunkMapReduce();
  const bundle = testBundleShape();
  console.log(
    JSON.stringify(
      {
        citations,
        chunks,
        bundle,
      },
      null,
      2
    )
  );
  console.log("ok — local evidence + summarization fixture assertions passed");
}

main();
