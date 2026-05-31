export interface Env {
  DUELS_KV: KVNamespace;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function generateId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(10);
  crypto.getRandomValues(array);
  let id = "";
  for (let i = 0; i < 10; i++) {
    id += chars[array[i] % chars.length];
  }
  return id;
}

const CURATED_TOPICS = [
  "Should AI write my LinkedIn posts?",
  "Is vibe coding real engineering?",
  "Should agents have permissions, or just do what they're told?",
  "Is RAG dead?",
  "Should startups build their own foundation model?",
  "Will AGI arrive in 2027?",
  "Is on-device AI actually better than cloud AI?",
  "Should the EU AI Act be repealed?",
  "Does open-source AI win in the long run?",
  "Are personal AI agents the next OS?",
  "Should I quit my job to start an AI startup?",
  "Is voice the right primary interface for AI?",
  "Is manual testing obsolete?",
  "Should LLMs be allowed to self-improve?",
  "Is Prompt Engineering a long-term career?",
  "Should web apps target WebGPU, or stick to WebGL?",
  "Is Javascript still the king of web development?",
  "Will AI tools replace human junior developers by 2028?",
  "Should code editors have full agentic write access?",
  "Is Copilot making developers better or lazier?",
  "Should foundation models be regulated?",
  "Is local-first software the future of web apps?",
  "Should LLM weights be public by default?",
  "Is Git the best version control for AI-generated code?"
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Helper to return JSON responses with CORS headers
    const jsonResponse = (data: any, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    };

    try {
      // POST /api/save-duel
      if (path === "/api/save-duel" && request.method === "POST") {
        const bodyText = await request.text();
        // Limit body size to 100KB to protect KV free tier limits
        if (bodyText.length > 100 * 1024) {
          return jsonResponse({ error: "Payload too large" }, 413);
        }

        let body: any;
        try {
          body = JSON.parse(bodyText);
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const { topic, models, transcript, seeds } = body;

        // Basic validation
        if (!topic || !models || !transcript || !seeds) {
          return jsonResponse({ error: "Missing required fields" }, 400);
        }

        const id = generateId();
        const duelKey = `duel:${id}`;
        
        await env.DUELS_KV.put(duelKey, JSON.stringify({
          topic,
          models,
          transcript,
          seeds,
          createdAt: new Date().toISOString(),
        }));

        return jsonResponse({ id });
      }

      // GET /api/duel/:id
      if (path.startsWith("/api/duel/") && request.method === "GET") {
        const id = path.substring("/api/duel/".length);
        if (!id || id.includes("/")) {
          return jsonResponse({ error: "Invalid ID" }, 400);
        }

        const duelDataStr = await env.DUELS_KV.get(`duel:${id}`);
        if (!duelDataStr) {
          return jsonResponse({ error: "Duel not found" }, 404);
        }

        const duelData = JSON.parse(duelDataStr);
        
        // Fetch votes
        const votesStr = await env.DUELS_KV.get(`votes:${id}`);
        const votes = votesStr ? JSON.parse(votesStr) : { A: 0, B: 0 };

        return jsonResponse({
          ...duelData,
          votes,
        });
      }

      // POST /api/vote
      if (path === "/api/vote" && request.method === "POST") {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const { duel_id, winner } = body;
        if (!duel_id || (winner !== "A" && winner !== "B")) {
          return jsonResponse({ error: "Invalid vote payload" }, 400);
        }

        // Verify duel exists before voting
        const duelExists = await env.DUELS_KV.get(`duel:${duel_id}`);
        if (!duelExists) {
          return jsonResponse({ error: "Duel not found" }, 404);
        }

        // Use a simple read-modify-write for voting
        const votesKey = `votes:${duel_id}`;
        const votesStr = await env.DUELS_KV.get(votesKey);
        const votes = votesStr ? JSON.parse(votesStr) : { A: 0, B: 0 };
        
        votes[winner] = (votes[winner] || 0) + 1;
        await env.DUELS_KV.put(votesKey, JSON.stringify(votes));

        return jsonResponse({ success: true, votes });
      }

      // GET /api/topic-of-the-day
      if (path === "/api/topic-of-the-day" && request.method === "GET") {
        let daily = await env.DUELS_KV.get("topic-of-the-day");
        if (!daily) {
          // Self-healing: if the cron trigger hasn't populated it yet, dynamically compute
          const dayOfYear = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
          const topicIndex = dayOfYear % CURATED_TOPICS.length;
          const topic = CURATED_TOPICS[topicIndex];
          const data = { topic, updatedAt: new Date().toISOString() };
          await env.DUELS_KV.put("topic-of-the-day", JSON.stringify(data));
          return jsonResponse(data);
        }
        return jsonResponse(JSON.parse(daily));
      }

      // GET /api/curated-topics
      if (path === "/api/curated-topics" && request.method === "GET") {
        return jsonResponse({ topics: CURATED_TOPICS });
      }

      return jsonResponse({ error: "Not Found" }, 404);
    } catch (err: any) {
      return jsonResponse({ error: err.message || "Internal Server Error" }, 500);
    }
  },

  // Cron trigger scheduled task
  async scheduled(event: any, env: Env, ctx: ExecutionContext): Promise<void> {
    const dayOfYear = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const topicIndex = dayOfYear % CURATED_TOPICS.length;
    const topic = CURATED_TOPICS[topicIndex];
    
    await env.DUELS_KV.put("topic-of-the-day", JSON.stringify({
      topic,
      updatedAt: new Date().toISOString(),
    }));
  },
};

