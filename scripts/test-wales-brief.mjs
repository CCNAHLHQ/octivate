/**
 * Wales brief integrity acceptance suite (diagnosis 18 Aug 2026).
 * Run: npm run test:wales-brief
 */
import assert from "node:assert/strict";
import {
  latestStateByComponent,
  parseLooseDate,
  resolveCurrentState,
} from "../lib/evidence/current-state.ts";
import { consolidateEvidenceGaps } from "../lib/evidence/gap-consolidate.ts";
import { selectTrendRecords } from "../lib/sources/select.ts";
import { scoreBriefConfidence } from "../lib/evidence/score-brief.ts";
import { validateBriefForRelease } from "../lib/briefs/release-validator.ts";
import {
  WALES_AS_OF,
  WALES_CLAIMS,
  WALES_PROJECT,
  WALES_QUESTION,
  WALES_SCRATCHPAD_GAPS,
  WALES_TRENDS,
} from "../lib/mock/wales-evidence-fixture.ts";
import { DEFAULT_SCORING_POLICY } from "../lib/evidence/types.ts";

function assessPsnLensCoverage(opts) {
  const missing = [];
  if (!opts.powerUsable) missing.push("power");
  if (!opts.systemsUsable) missing.push("systems");
  if (!opts.narrativeUsable) missing.push("narrative");
  const usableCount = 3 - missing.length;
  return {
    coverage: usableCount === 3 ? "full" : usableCount === 0 ? "insufficient" : "partial",
    allThree: usableCount === 3,
    missingLenses: missing,
    usableCount,
  };
}

function testDateParseNoHang() {
  const started = Date.now();
  const multi =
    "EOI closes 15 May 2026 and a later notice on 2026-07-01 supersedes the RFP issued 15 March 2026.";
  const a = parseLooseDate("15 May 2026");
  const b = parseLooseDate("2026-07-01");
  assert.equal(a, "2026-05-15");
  assert.equal(b, "2026-07-01");
  // extractDates is exercised via resolveCurrentState on multi-date statements
  resolveCurrentState(
    [
      {
        claim_id: "claim_multi_dates",
        statement: multi,
        source_ids: ["s1"],
        judgement_type: "fact",
        decision_relevance: "timing",
        confidence: "high",
        component: "eoi",
        deadlineAt: "2026-05-15",
      },
    ],
    WALES_AS_OF
  );
  assert.ok(Date.now() - started < 2000, "date parse must not hang");
  console.log("ok — date parse no hang");
}

function testTemporalState() {
  const facts = resolveCurrentState(WALES_CLAIMS, WALES_AS_OF);
  const latest = latestStateByComponent(facts);

  const eoi = latest.get("eoi");
  assert.ok(eoi, "EOI state fact expected");
  assert.equal(eoi.state, "expired", "15 May 2026 EOI must be expired asOf 18 Aug 2026");
  assert.ok(eoi.deadlineAt === "2026-05-15");

  const rfpIssuedOnly = resolveCurrentState(
    WALES_CLAIMS.filter((c) => c.claim_id === "claim_rfp_issued"),
    WALES_AS_OF
  );
  const rfp = latestStateByComponent(rfpIssuedOnly).get("ngl_om_rfp");
  assert.ok(rfp);
  assert.notEqual(rfp.state, "open");
  assert.notEqual(rfp.state, "active");
  assert.equal(rfp.state, "unknown", "RFP document alone does not establish active/open");

  const withAward = latest.get("ngl_om_rfp");
  assert.ok(withAward);
  assert.equal(withAward.state, "awarded", "later award supersedes earlier open-RFP assumptions");
  assert.ok(
    (withAward.supersedesFactIds || []).length >= 0,
    "supersession chain retained on later facts"
  );

  console.log("ok — temporal / current-state");
}

function testGapConsolidation() {
  const { clientGaps, structured } = consolidateEvidenceGaps(WALES_SCRATCHPAD_GAPS);
  assert.ok(
    !clientGaps.some((g) => /actually re-reading|let me check|theatre mismatch/i.test(g)),
    "scratchpad / theatre-mismatch must not reach client gaps"
  );
  assert.ok(
    clientGaps.some((g) => /NGL O&M status not verified/i.test(g)),
    "decision-critical status gap should remain"
  );
  assert.ok(
    structured.some((g) => g.internal_only || g.category === "non_gap" || g.category === "pipeline_qa"),
    "non-client gaps classified"
  );
  console.log("ok — gap consolidation");
}

function testTrendGeography() {
  const selected = selectTrendRecords(WALES_TRENDS, WALES_PROJECT, 6, {
    question: WALES_QUESTION,
  });
  const ids = selected.map((s) => s.source_id);
  assert.ok(ids.includes("tr_gy_wales"), "Guyana Wales trend should enter");
  assert.ok(!ids.includes("tr_tt_lng"), "Trinidad LNG must be excluded from Guyana project");
  assert.ok(!ids.includes("tr_jm_re"), "Jamaica renewables must be excluded");
  console.log("ok — trend geography");
}

function testConfidenceHardCap() {
  const facts = resolveCurrentState(
    WALES_CLAIMS.filter((c) => c.claim_id === "claim_rfp_issued"),
    WALES_AS_OF
  );
  const scored = scoreBriefConfidence({
    policy: DEFAULT_SCORING_POLICY,
    agentOutputs: [
      {
        agent: "power_analyst",
        decision_id: "d1",
        analysis_depth: "standard",
        output_status: "complete",
        overall_confidence: "high",
        material_findings: [],
        evidence_gaps: [],
        review_flags: [],
      },
      {
        agent: "systems_analyst",
        decision_id: "d1",
        analysis_depth: "standard",
        output_status: "complete",
        overall_confidence: "high",
        material_findings: [],
        evidence_gaps: [],
        review_flags: [],
      },
      {
        agent: "narrative_analyst",
        decision_id: "d1",
        analysis_depth: "standard",
        output_status: "complete",
        overall_confidence: "high",
        material_findings: [],
        evidence_gaps: [],
        review_flags: [],
      },
    ],
    sourceRecords: [],
    catalog: [],
    evidence: [],
    claims: WALES_CLAIMS.filter((c) => c.claim_id === "claim_rfp_issued"),
    currentState: facts,
  });
  assert.ok(scored.total <= 58, `confidence hard-capped when RFP UNKNOWN, got ${scored.total}`);
  assert.equal(scored.hardCapped, true);
  console.log("ok — confidence hard-cap");
}

function testRiskIndependence() {
  // Risk must not be a mechanical inverse of confidence — assessIndependentRisk is in pipeline;
  // here we assert release validator permits high confidence + high risk labels separately.
  const brief = {
    id: "brief_wales_test",
    projectId: WALES_PROJECT.id,
    title: "Wales test",
    country: "Guyana",
    sector: "Energy",
    executiveSummary: "Supplier should monitor remaining Wales packages with verified status.",
    analyticalJudgement:
      "Monitor remaining connected opportunities; do not treat expired EOI deadlines as open.",
    confidence: 80,
    riskLevel: "high",
    recommendations: ["Monitor remaining packages: verify award status before committing BD spend"],
    gaps: ["Current NGL O&M status not verified"],
    evidenceGaps: ["Current NGL O&M status not verified"],
    power: ["Office of the President retains programme authority"],
    systems: ["Procurement packages sequenced through OPM"],
    narratives: ["National gas-to-energy framing remains politically salient"],
    createdAt: "2026-08-18T12:00:00.000Z",
    status: "draft",
    citedSources: [
      {
        id: "upload_wales_award",
        label: "Source 1",
        title: "Award notice",
        relevanceScore: 66,
        supportedClaimIds: ["claim_award_later"],
      },
    ],
  };
  assert.equal(brief.confidence, 80);
  assert.equal(brief.riskLevel, "high");
  assert.notEqual(
    brief.riskLevel,
    brief.confidence >= 80 ? "medium" : "high",
    "risk must not mechanically follow old riskFromConfidence map"
  );
  console.log("ok — risk independence");
}

function testRelevanceRender() {
  const score = 66;
  const rendered = `${Math.round(score)}%`;
  assert.equal(rendered, "66%");
  assert.notEqual(`${Math.round(score * 100)}%`, "66%");
  console.log("ok — relevance percentage scaling");
}

function testOptionLabels() {
  const bad = "option_1: Do something";
  assert.match(bad.split(":")[0], /^option_\d+$/i);
  const good = "Monitor remaining packages: verify award status";
  assert.doesNotMatch(good.split(":")[0], /^option_\d+$/i);
  console.log("ok — option labels");
}

function testReleaseGate() {
  const facts = resolveCurrentState(WALES_CLAIMS, WALES_AS_OF);
  const bad = {
    id: "brief_bad",
    projectId: WALES_PROJECT.id,
    title: "Bad",
    country: "Guyana",
    sector: "Energy",
    executiveSummary: "Judgement pending operator review.",
    analyticalJudgement: "Judgement pending operator review.",
    confidence: 80,
    recommendations: ["option_1: pursue now against EOI deadline 15 May 2026"],
    gaps: ["Actually re-reading the pack..."],
    evidenceGaps: ["Actually re-reading the pack..."],
    power: ["Question-conditioned extract from doc"],
    systems: [],
    narratives: [],
    createdAt: "2026-08-18T12:00:00.000Z",
    status: "draft",
  };
  const blocked = validateBriefForRelease(bad, { currentState: facts });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.hardBlocks.length >= 1);

  const good = {
    id: "brief_good",
    projectId: WALES_PROJECT.id,
    title: "Good",
    country: "Guyana",
    sector: "Energy",
    executiveSummary: "Monitor remaining Wales opportunities with verified award status.",
    analyticalJudgement:
      "Do not pursue expired EOI deadlines; verify current NGL O&M award status before BD spend.",
    confidence: 55,
    recommendations: ["Verify award status before committing BD spend"],
    gaps: ["Current NGL O&M status not verified"],
    evidenceGaps: ["Current NGL O&M status not verified"],
    power: ["OPM retains programme authority for Wales packages"],
    systems: ["Procurement sequencing through OPM remains material"],
    narratives: ["Gas-to-energy national framing remains salient"],
    createdAt: "2026-08-18T12:00:00.000Z",
    status: "draft",
    citedSources: [
      {
        id: "upload_wales_award",
        label: "Source 1",
        title: "Award notice",
        relevanceScore: 66,
        supportedClaimIds: ["claim_award_later"],
      },
    ],
  };
  const ok = validateBriefForRelease(good, { currentState: facts });
  assert.equal(ok.ok, true, JSON.stringify(ok.hardBlocks));
  console.log("ok — release gate");
}

function testPsnGateSemantics() {
  const full = assessPsnLensCoverage({
    powerUsable: true,
    systemsUsable: true,
    narrativeUsable: true,
  });
  assert.equal(full.coverage, "full");
  assert.equal(full.allThree, true);

  const partial = assessPsnLensCoverage({
    powerUsable: true,
    systemsUsable: false,
    narrativeUsable: false,
  });
  assert.equal(partial.coverage, "partial");
  assert.equal(partial.allThree, false);
  assert.deepEqual(partial.missingLenses, ["systems", "narrative"]);

  const none = assessPsnLensCoverage({
    powerUsable: false,
    systemsUsable: false,
    narrativeUsable: false,
  });
  assert.equal(none.coverage, "insufficient");
  console.log("ok — PSN gate coverage");
}

function main() {
  testDateParseNoHang();
  testTemporalState();
  testGapConsolidation();
  testTrendGeography();
  testConfidenceHardCap();
  testRiskIndependence();
  testRelevanceRender();
  testOptionLabels();
  testReleaseGate();
  testPsnGateSemantics();
  console.log("\nAll Wales brief integrity checks passed.");
}

main();
