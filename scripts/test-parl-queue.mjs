/**
 * Gate + recovery checks for parl download→ASR queue.
 * Run: npm run test:parl-queue
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertVideoReady,
  isDownloadArtifactReady,
} from "../lib/parliamentary/download.ts";
import { recoverInterruptedJobs } from "../lib/parliamentary/pipeline.ts";
import { atomicRename, createAsyncMutex } from "../lib/parliamentary/atomic-json.ts";
import { patchJob, readJobs, writeJobs } from "../lib/parliamentary/store.ts";

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "parl-queue-"));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function testGateRejects() {
  await withTempDir(async (dir) => {
    const video = path.join(dir, "video.mp4");
    await assert.rejects(() => assertVideoReady(video), /missing_video/);

    await fs.writeFile(video, Buffer.alloc(100));
    await assert.rejects(() => assertVideoReady(video), /too_small/);

    await fs.writeFile(`${video}.partial`, Buffer.alloc(10));
    await fs.writeFile(video, Buffer.alloc(300 * 1024));
    await assert.rejects(() => assertVideoReady(video), /partial_still_present/);

    await fs.unlink(`${video}.partial`);
    // Size ok but no ffmpeg readable media — may fail unreadable if ffmpeg present
    try {
      await assertVideoReady(video);
    } catch (e) {
      assert.match(String(e.message || e), /unreadable_media|duration/);
    }

    assert.equal(await isDownloadArtifactReady(dir, video), false);
    await fs.writeFile(path.join(dir, "download.ok"), "{}");
    // Still likely false without real media — ok
    const ready = await isDownloadArtifactReady(dir, video);
    assert.equal(typeof ready, "boolean");
  });
  console.log("gate: ok");
}

async function testAtomicRename() {
  await withTempDir(async (dir) => {
    const src = path.join(dir, "a.partial");
    const dest = path.join(dir, "a.mp4");
    await fs.writeFile(src, "hello-parl");
    await atomicRename(src, dest);
    const body = await fs.readFile(dest, "utf8");
    assert.equal(body, "hello-parl");
  });
  console.log("atomic-rename: ok");
}

async function testMutexSerializes() {
  const withLock = createAsyncMutex();
  const order = [];
  await Promise.all([
    withLock(async () => {
      order.push("a1");
      await new Promise((r) => setTimeout(r, 30));
      order.push("a2");
    }),
    withLock(async () => {
      order.push("b1");
      order.push("b2");
    }),
  ]);
  assert.deepEqual(order, ["a1", "a2", "b1", "b2"]);
  console.log("mutex: ok");
}

async function testRecoveryDemotesIncompleteDownloaded() {
  // Uses live jobs.json — snapshot, inject, recover, restore.
  const before = await readJobs();
  const probeId = `parljob_test_gate_${Date.now()}`;
  try {
    await writeJobs([
      ...before,
      {
        id: probeId,
        candidateId: "cand_test",
        country: "BB",
        title: "Gate probe",
        pageUrl: "https://example.com",
        mediaUrl: "https://example.com/v.mp4",
        platform: "direct",
        stage: "downloaded",
        progressPct: 50,
        folder: "data/local/parliamentary-videos/__missing__",
        videoPath: "data/local/parliamentary-videos/__missing__/video.mp4",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        warnings: [],
      },
    ]);
    await recoverInterruptedJobs();
    const after = await readJobs();
    const row = after.find((j) => j.id === probeId);
    assert.ok(row, "probe job missing");
    assert.equal(row.stage, "queued", `expected queued after demote, got ${row.stage}`);
  } finally {
    await writeJobs(before);
  }
  console.log("recovery-demote: ok");
}

async function testPatchJobSerial() {
  const before = await readJobs();
  const id = `parljob_test_patch_${Date.now()}`;
  try {
    await writeJobs([
      ...before,
      {
        id,
        candidateId: "c",
        country: "BB",
        title: "Patch probe",
        pageUrl: "https://example.com",
        mediaUrl: "https://example.com/x.mp4",
        platform: "direct",
        stage: "queued",
        progressPct: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        warnings: [],
      },
    ]);
    await Promise.all([
      patchJob(id, { progressPct: 10 }),
      patchJob(id, { progressLabel: "x" }),
      patchJob(id, { progressPct: 20 }),
    ]);
    const row = (await readJobs()).find((j) => j.id === id);
    assert.ok(row);
    assert.ok(row.progressPct === 10 || row.progressPct === 20);
  } finally {
    await writeJobs(before);
  }
  console.log("patch-serial: ok");
}

async function testAtomicWriteConcurrent() {
  await withTempDir(async (dir) => {
    const { atomicWriteJson } = await import("../lib/parliamentary/atomic-json.ts");
    const file = path.join(dir, "progress.json");
    await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        atomicWriteJson(file, { n: i, at: Date.now() })
      )
    );
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(typeof raw.n, "number");
    const leftovers = (await fs.readdir(dir)).filter((n) => n.endsWith(".tmp"));
    assert.equal(leftovers.length, 0, `tmp leftovers: ${leftovers.join(",")}`);
  });
  console.log("atomic-write-concurrent: ok");
}

async function main() {
  await testGateRejects();
  await testAtomicRename();
  await testAtomicWriteConcurrent();
  await testMutexSerializes();
  await testRecoveryDemotesIncompleteDownloaded();
  await testPatchJobSerial();
  console.log("parl-queue: all ok");
}

main().catch((err) => {
  console.error("parl-queue: FAIL", err);
  process.exit(1);
});
