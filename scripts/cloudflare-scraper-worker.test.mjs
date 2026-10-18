import assert from "node:assert/strict";
import test from "node:test";
import { scheduled, taskForCron } from "../workers/catalog-scheduler/src/index.mjs";

test("catalog scheduler maps its two schedules to bounded API task types", () => {
  assert.equal(taskForCron("0 */6 * * *"), "scrape");
  assert.equal(taskForCron("30 */6 * * *"), "trending");
  assert.throws(() => taskForCron("0 0 * * *"), /Unconfigured/);
});

test("scheduled worker calls the Nest cron endpoint with task and bearer secret", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: new URL(url), options };
    return new Response(JSON.stringify({ hasMore: true, summary: { items_processed: 10 } }), { status: 200 });
  };
  try {
    await scheduled({ cron: "30 */6 * * *" }, { API_BASE_URL: "https://api.netix.example/", SCRAPER_SECRET: "test-only" });
    assert.equal(request.url.pathname, "/api/cron/scraper");
    assert.equal(request.url.searchParams.get("task"), "trending");
    assert.equal(request.options.headers.Authorization, "Bearer test-only");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scheduled worker rejects missing secrets and failed API responses", async () => {
  await assert.rejects(scheduled({ cron: "0 */6 * * *" }, {}), /required/);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    await assert.rejects(scheduled({ cron: "0 */6 * * *" }, { API_BASE_URL: "https://api.netix.example", SCRAPER_SECRET: "test-only" }), /503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
