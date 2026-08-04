import { NextRequest } from "next/server";
import { guardApi } from "@/lib/security/guard";
import {
  leanThread,
  listSupportThreads,
  subscribeSupport,
  subscribeSupportTyping,
} from "@/lib/support/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      void listSupportThreads().then((rows) => {
        const threads = rows.map(leanThread);
        send({
          type: "snapshot",
          threads,
          open: threads.filter((t) => t.status !== "closed").length,
        });
      });

      const unsub = subscribeSupport((thread) => {
        send({ type: "thread", thread: leanThread(thread) });
      });

      const unsubTyping = subscribeSupportTyping((event) => {
        send({ type: "typing", ...event });
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
