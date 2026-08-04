import { NextRequest } from "next/server";
import { guardApi } from "@/lib/security/guard";
import { resolveRequestUser } from "@/lib/auth/scope";
import {
  getSupportThread,
  getSupportTyping,
  publicThread,
  subscribeSupport,
  subscribeSupportTyping,
} from "@/lib/support/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;

  const { id } = await params;
  const thread = await getSupportThread(id);
  if (!thread) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await resolveRequestUser(req);
  const allowed =
    (user && thread.userId === user.id) || (user && user.role === "operator");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({
        type: "snapshot",
        thread: publicThread(thread),
        typing: getSupportTyping(id),
      });

      const unsub = subscribeSupport((next) => {
        if (next.id !== id) return;
        send({ type: "thread", thread: publicThread(next) });
      });

      const unsubTyping = subscribeSupportTyping((event) => {
        if (event.threadId !== id) return;
        send({ type: "typing", typing: event.typing });
      });

      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsub();
        unsubTyping();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);
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
