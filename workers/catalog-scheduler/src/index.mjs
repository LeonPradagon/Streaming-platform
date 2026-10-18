const TASK_BY_CRON = new Map([
  ["0 */6 * * *", "scrape"],
  ["30 */6 * * *", "trending"],
]);

export function taskForCron(cron) {
  const task = TASK_BY_CRON.get(cron);
  if (!task) throw new Error(`Unconfigured catalog scheduler cron: ${cron}`);
  return task;
}

export async function scheduled(event, env) {
  const task = taskForCron(event.cron);
  if (!env.API_BASE_URL || !env.SCRAPER_SECRET) {
    throw new Error("API_BASE_URL and SCRAPER_SECRET Worker secrets are required.");
  }

  const url = new URL("/api/cron/scraper", env.API_BASE_URL);
  url.searchParams.set("task", task);
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.SCRAPER_SECRET}` },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Scraper ${task} request failed (${response.status}): ${detail}`);
  }

  const result = await response.json();
  console.log(JSON.stringify({ task, status: response.status, hasMore: result.hasMore, summary: result.summary }));
}

export default {
  scheduled,
  fetch() {
    return new Response("Not found", { status: 404 });
  },
};
