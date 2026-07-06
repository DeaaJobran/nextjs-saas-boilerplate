import { runWorker } from "./index";

const abortController = new AbortController();

function stopWorker() {
  abortController.abort();
}

process.once("SIGINT", stopWorker);
process.once("SIGTERM", stopWorker);

await runWorker({
  handlers: {
    healthcheck: async () => {},
  },
  signal: abortController.signal,
  workerId: `worker-${process.pid}`,
});
