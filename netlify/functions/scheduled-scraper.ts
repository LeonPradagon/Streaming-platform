import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  const { next_run } = await req.json();

  console.log("Scheduled scraper triggered. Next run at:", next_run);

  // Use the site's own URL to trigger the API endpoint
  // Netlify provides the URL in the environment
  const siteUrl = process.env.URL || "http://localhost:3000";
  const secret = process.env.SCRAPER_SECRET || "";

  try {
    const response = await fetch(`${siteUrl}/api/scraper/automate?secret=${secret}`, {
      method: "GET",
    });

    const data = await response.json();
    console.log("Scraper Response:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Failed to trigger scraper:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
};

export const config: Config = {
  // Run every hour
  schedule: "@hourly",
};
