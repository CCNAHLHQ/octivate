import { NextRequest } from "next/server";
import { clientIp, extractBearer, getExpectedApiKey, getExpectedOperatorKey } from "@/lib/security/api-key";
import { rateLimit } from "@/lib/security/rate-limit";
import { resolveRequestUser } from "@/lib/auth/scope";
import { assertProjectAccess } from "@/lib/auth/scope";
import { getSession, subscribeSession } from "@/lib/agents/orchestrator";
import { readCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import type { Project } from "@/lib/types";
import { emitOpsEvent } from "@/lib/ops/event-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = clientIp(req);
  const rl = rateLimit(`${ip}:sse`, 30, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 });
  }

  const key = extractBearer(req);
  const apiKey = getExpectedApiKey();
  const opKey = getExpectedOperatorKey();
  const keyOk = !!key && (key === apiKey || key === opKey);
  const user = await resolveRequestUser(req);

  if (!keyOk && !user) {
    void emitOpsEvent({
      level: "warn",
      source: "security",
      message: "sse_denied_unauthenticated",
      meta: { sessionId: id },
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const session = await getSession(id);
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  if (!keyOk && user) {
    const projects = await readCollection<Project>("projects", SEED_PROJECTS);
    const project = projects.find((p) => p.id === session.projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
    }
    const access = assertProjectAccess(project, user);
    if (!access.ok) {
      return new Response(JSON.stringify({ error: access.error }), { status: access.status });
    }
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "snapshot", session });

      const unsub = subscribeSession(id, (s) => {
        send({ type: "update", session: s });
        if (s.status === "completed" || s.status === "failed") {
          send({ type: "done", session: s });
          cleanup();
        }
      });

      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);

      if (session.status === "completed" || session.status === "failed") {
        setTimeout(cleanup, 300);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
