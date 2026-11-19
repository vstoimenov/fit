import { serverEnv } from "@/env";
import { llmsTxt } from "@/lib/site/seo";
import { getPublicPlans } from "@/server/site/content";

/** /llms.txt: the club's facts in plain markdown for AI assistants (see llmstxt.org). */
export async function GET() {
  const body = llmsTxt({ baseUrl: serverEnv.APP_URL, plans: await getPublicPlans() });
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
