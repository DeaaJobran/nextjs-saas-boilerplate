import { randomUUID } from "node:crypto";

import { apiFailure } from "@nextjs-saas/api";

import { getApiService, getRequestContext, handleApiOptions } from "@/lib/api";

const eventStreamHeartbeatMs = 15_000;
const eventStreamPollMs = 5_000;

type EventStreamItem = {
  eventType: string;
  id: string;
  occurredAt: string;
};

function encodeEvent(event: EventStreamItem) {
  return `event: ${event.eventType}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const service = getApiService();
  const startedAt = Date.now();
  const requestContext = getRequestContext(request);
  const requestId = requestContext.requestId ?? randomUUID();
  const path = new URL(request.url).pathname;
  const { organizationId } = await context.params;
  const headers = {
    ...service.createCorsHeaders(request.headers.get("origin")),
    "cache-control": "no-store",
    "content-type": "text/event-stream; charset=utf-8",
  };

  try {
    const principal = await service.authenticateBearerToken({
      authorizationHeader: request.headers.get("authorization"),
    });

    service.requireScopes(principal, ["events:read"]);

    const result = await service.listEvents({
      limit: 25,
      organizationId,
      principal,
      sort: "desc",
    });
    const initialEvents = [...result.items].reverse();
    const encoder = new TextEncoder();
    const seenEventIds = new Set(initialEvents.map((event) => event.id));
    let cursor = initialEvents.at(-1)?.occurredAt;

    await service.recordApiRequest({
      context: { ...requestContext, requestId },
      durationMs: Date.now() - startedAt,
      method: "GET",
      path,
      principal,
      routeId: "streamEvents",
      statusCode: 200,
      tenantId: organizationId,
    });

    let cleanupStream = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let polling = false;
        const intervals: ReturnType<typeof setInterval>[] = [];
        let removeAbortListener = () => {};

        const write = (message: string) => {
          if (!closed) {
            controller.enqueue(encoder.encode(message));
          }
        };
        const cleanup = () => {
          closed = true;

          for (const interval of intervals) {
            clearInterval(interval);
          }

          removeAbortListener();
        };
        cleanupStream = cleanup;
        const close = () => {
          if (closed) {
            return;
          }

          cleanup();
          controller.close();
        };
        const poll = async () => {
          if (closed || polling) {
            return;
          }

          polling = true;

          try {
            const next = await service.listEvents({
              cursor,
              limit: 25,
              organizationId,
              principal,
              sort: "asc",
            });

            for (const event of next.items) {
              cursor = event.occurredAt;

              if (seenEventIds.has(event.id)) {
                continue;
              }

              seenEventIds.add(event.id);
              write(encodeEvent(event));
            }
          } catch {
            write(
              `event: error\ndata: ${JSON.stringify({
                message: "Event stream interrupted.",
              })}\n\n`,
            );
            close();
          } finally {
            polling = false;
          }
        };
        const abort = () => close();

        request.signal.addEventListener("abort", abort, { once: true });
        removeAbortListener = () =>
          request.signal.removeEventListener("abort", abort);

        write(": connected\n\n");

        for (const event of initialEvents) {
          write(encodeEvent(event));
        }

        intervals.push(
          setInterval(() => write(": heartbeat\n\n"), eventStreamHeartbeatMs),
          setInterval(() => {
            void poll();
          }, eventStreamPollMs),
        );

        if (request.signal.aborted) {
          close();
        }
      },
      cancel() {
        cleanupStream();
      },
    });

    return new Response(stream, { headers });
  } catch (error) {
    const failure = apiFailure(error, requestId);

    await service.recordApiRequest({
      context: { ...requestContext, requestId },
      durationMs: Date.now() - startedAt,
      errorCode: failure.body.code,
      method: "GET",
      path,
      routeId: "streamEvents",
      statusCode: failure.status,
      tenantId: organizationId,
    });

    return Response.json(failure.body, {
      headers,
      status: failure.status,
    });
  }
}
