/* The growth series through fal's queue, in short requests only.
 *
 * The first version streamed the workflow from fal.run and wrote each stage into
 * data.json as its event arrived. That needs the response body to arrive
 * incrementally, and inside a WebContainer (bolt.new, StackBlitz) Node's fetch
 * hands the body over only once the whole response is complete: a twelve
 * minute stream turned into twelve minutes of nothing, and a dropped relay
 * connection left the run marked in flight forever. Submitting to the queue
 * and polling its status is a handful of sub-second requests, which every
 * environment can do, and the request id in data.json lets a restarted dev
 * server pick the same run back up.
 *
 * `fetch` is passed in rather than taken from the global so the HTTP edge can
 * be faked in tests without faking anything else. */

export const QUEUE = "https://queue.fal.run";

const headers = (key) => ({ Authorization: `Key ${key}`, "Content-Type": "application/json" });

/** Puts one run on the queue. Resolves with the handle to poll it by, or throws
 *  with fal's own words when the queue refuses. Never retries: a run costs
 *  real money. */
export async function submitRun(fetch, { workflow, key, input }) {
  const res = await fetch(`${QUEUE}/${workflow}`, { method: "POST", headers: headers(key), body: JSON.stringify(input) });
  if (!res.ok) throw new Error(`fal queue ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const job = await res.json();
  return { id: job.request_id, statusUrl: job.status_url, responseUrl: job.response_url };
}

/** One look at a run. Network trouble is reported as `unreachable` so the
 *  caller keeps polling; only fal itself can fail a run. */
export async function pollRun(fetch, run, key) {
  try {
    const poll = await fetch(run.statusUrl, { headers: headers(key) });
    if (!poll.ok) return { state: "failed", error: `fal status ${poll.status}: ${(await poll.text()).slice(0, 300)}` };
    const status = await poll.json();
    if (status.status === "IN_QUEUE") return { state: "queued", position: Number(status.queue_position) || 0 };
    if (status.status === "IN_PROGRESS") return { state: "running" };
    if (status.status !== "COMPLETED") return { state: "failed", error: `fal reported ${status.status ?? "an unknown status"}` };
    const done = await fetch(run.responseUrl, { headers: headers(key) });
    if (!done.ok) return { state: "failed", error: `fal result ${done.status}: ${(await done.text()).slice(0, 300)}` };
    return { state: "done", output: await done.json() };
  } catch (e) {
    return { state: "unreachable", error: e?.message ?? String(e) };
  }
}

/** What one poll result means for data.json. `settle` asks the caller to turn
 *  the output map into stages and the archive; that part knows the workflow's
 *  shape and stays with it. */
export function runPatch(result) {
  switch (result.state) {
    case "queued":
      return { patch: { runState: "queued", queuePosition: result.position }, settle: false };
    case "running":
      return { patch: { runState: "running", queuePosition: 0 }, settle: false };
    case "done":
      return { patch: {}, settle: true, output: result.output };
    case "failed":
      return { patch: { run: null, runState: "", queuePosition: 0, hatchedAt: 0, runError: result.error }, settle: false };
    default:
      return { patch: {}, settle: false };
  }
}
