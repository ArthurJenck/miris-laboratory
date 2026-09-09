import { test } from "node:test";
import assert from "node:assert/strict";
import { submitRun, pollRun, runPatch } from "../miris/growthQueue.mjs";

/* A fetch that answers from a script and records what it was asked. Only
   the HTTP edge is faked; everything the module does with the replies is real. */
const fakeFetch = (replies) => {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected fetch ${url}`);
    return {
      ok: reply.status < 400,
      status: reply.status,
      json: async () => reply.body,
      text: async () => (typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body)),
    };
  };
  fn.calls = calls;
  return fn;
};

const RUN = { id: "r1", statusUrl: "https://queue.fal.run/wf/requests/r1/status", responseUrl: "https://queue.fal.run/wf/requests/r1" };

test("submitRun posts the input to the queue with the key and returns the request handle", async () => {
  const fetch = fakeFetch([{ status: 200, body: { request_id: "r1", status_url: RUN.statusUrl, response_url: RUN.responseUrl } }]);
  const run = await submitRun(fetch, { workflow: "workflows/x/y", key: "k", input: { concept: "a fish" } });
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url, "https://queue.fal.run/workflows/x/y");
  assert.equal(fetch.calls[0].init.method, "POST");
  assert.equal(fetch.calls[0].init.headers.Authorization, "Key k");
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), { concept: "a fish" });
  assert.deepEqual(run, RUN);
});

test("submitRun surfaces fal's own message when the queue refuses the run", async () => {
  const fetch = fakeFetch([{ status: 422, body: { detail: "concept is required" } }]);
  await assert.rejects(() => submitRun(fetch, { workflow: "wf", key: "k", input: {} }), /422.*concept is required/);
});

test("pollRun reports a queued run with its position", async () => {
  const fetch = fakeFetch([{ status: 200, body: { status: "IN_QUEUE", queue_position: 3 } }]);
  assert.deepEqual(await pollRun(fetch, RUN, "k"), { state: "queued", position: 3 });
  assert.equal(fetch.calls[0].url, RUN.statusUrl);
  assert.equal(fetch.calls[0].init.headers.Authorization, "Key k");
});

test("pollRun reports a run that fal is working on", async () => {
  const fetch = fakeFetch([{ status: 200, body: { status: "IN_PROGRESS" } }]);
  assert.deepEqual(await pollRun(fetch, RUN, "k"), { state: "running" });
});

test("pollRun fetches the output once the run has completed", async () => {
  const output = { plan: "Stage 1: egg", model_1: { url: "a.glb" } };
  const fetch = fakeFetch([
    { status: 200, body: { status: "COMPLETED" } },
    { status: 200, body: output },
  ]);
  assert.deepEqual(await pollRun(fetch, RUN, "k"), { state: "done", output });
  assert.equal(fetch.calls[1].url, RUN.responseUrl);
});

test("pollRun reports a failed run with fal's message rather than throwing", async () => {
  const fetch = fakeFetch([{ status: 200, body: { status: "COMPLETED" } }, { status: 500, body: { detail: "node mesh3 failed" } }]);
  const res = await pollRun(fetch, RUN, "k");
  assert.equal(res.state, "failed");
  assert.match(res.error, /mesh3 failed/);
});

test("pollRun treats a network error as a transient miss, not a failure", async () => {
  const fetch = async () => {
    throw new Error("fetch failed");
  };
  assert.deepEqual(await pollRun(fetch, RUN, "k"), { state: "unreachable", error: "fetch failed" });
});

test("runPatch keeps waiting while the run is queued or running and records what fal said", () => {
  assert.deepEqual(runPatch({ state: "queued", position: 2 }), { patch: { runState: "queued", queuePosition: 2 }, settle: false });
  assert.deepEqual(runPatch({ state: "running" }), { patch: { runState: "running", queuePosition: 0 }, settle: false });
  assert.deepEqual(runPatch({ state: "unreachable", error: "x" }), { patch: {}, settle: false });
});

test("runPatch hands a finished run over to be settled and clears the handle", () => {
  const out = runPatch({ state: "done", output: { plan: "p" } });
  assert.equal(out.settle, true);
  assert.deepEqual(out.output, { plan: "p" });
});

test("runPatch turns a failed run into a cleared run with the message the attendee should read", () => {
  assert.deepEqual(runPatch({ state: "failed", error: "node mesh3 failed" }), {
    patch: { run: null, runState: "", queuePosition: 0, hatchedAt: 0, runError: "node mesh3 failed" },
    settle: false,
  });
});
