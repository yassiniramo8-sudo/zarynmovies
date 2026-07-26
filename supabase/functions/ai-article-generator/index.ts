import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANG_LABELS: Record<string, string> = {
  en: "English", ar: "Arabic", fr: "French", es: "Spanish", tr: "Turkish",
  de: "German", ja: "Japanese", ko: "Korean", pt: "Portuguese", hi: "Hindi",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, language, keywords, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const langLabel = LANG_LABELS[language] || "English";

    if (action === "search_images") {
      // Use AI to suggest image search queries for the topic
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You suggest relevant Unsplash image search queries for articles. Return JSON only." },
            { role: "user", content: `For an article about "${topic}", suggest 4 relevant image search terms. Return JSON: { "queries": ["term1","term2","term3","term4"] }` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "suggest_images",
              description: "Return image search queries",
              parameters: {
                type: "object",
                properties: {
                  queries: { type: "array", items: { type: "string" } },
                },
                required: ["queries"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "suggest_images" } },
        }),
      });

      const data = await resp.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      let queries = ["technology", "business", "nature", "abstract"];
      if (toolCall?.function?.arguments) {
        try { queries = JSON.parse(toolCall.function.arguments).queries; } catch {}
      }

      // Fetch images from Unsplash (free API, no key needed for small usage)
      const images = [];
      for (const q of queries.slice(0, 4)) {
        try {
          const imgResp = await fetch(`https://source.unsplash.com/800x450/?${encodeURIComponent(q)}`);
          if (imgResp.ok) {
            images.push({
              url: imgResp.url,
              query: q,
              alt: `${q} - ${topic}`,
            });
          }
        } catch {}
      }

      return new Response(JSON.stringify({ success: true, images }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Main article generation
    const keywordStr = keywords?.length ? `\nEmphasize these keywords: ${keywords.join(", ")}` : "";

    const systemPrompt = `You are a professional content writer and SEO expert for a streaming/entertainment website called "Zaryn Movies" (zaryn.movies). 
Write ALL content in ${langLabel}. Only proper names (brands, people, places) may remain untranslated.
You produce high-quality, unique, engaging articles with perfect SEO optimization.`;

    const userPrompt = `Write a comprehensive, professional article about: "${topic}"
${keywordStr}

Requirements:
1. Article must be 800-1500 words, well-structured with H2 and H3 headings
2. Include an engaging introduction and a strong conclusion
3. Use bullet points and numbered lists where appropriate
4. Write in ${langLabel} language
5. Make it SEO-optimized with natural keyword placement

Also generate:
- SEO meta title (under 60 chars)
- SEO meta description (under 160 chars)
- 5-8 relevant tags/keywords
- A suggested category
- A short excerpt (2-3 sentences)
- OpenGraph title and description
- Suggested image alt texts (3 images)`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_article",
            description: "Generate a full article with SEO metadata",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Article title" },
                content: { type: "string", description: "Full HTML article content with headings, paragraphs, lists" },
                excerpt: { type: "string", description: "Short 2-3 sentence excerpt" },
                category: { type: "string", description: "Article category" },
                tags: { type: "array", items: { type: "string" }, description: "5-8 SEO tags" },
                seo: {
                  type: "object",
                  properties: {
                    meta_title: { type: "string" },
                    meta_description: { type: "string" },
                    og_title: { type: "string" },
                    og_description: { type: "string" },
                    image_alts: { type: "array", items: { type: "string" } },
                  },
                  required: ["meta_title", "meta_description", "og_title", "og_description", "image_alts"],
                  additionalProperties: false,
                },
              },
              required: ["title", "content", "excerpt", "category", "tags", "seo"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_article" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI error:", resp.status, t);
      throw new Error("AI generation failed");
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No article generated");

    const article = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, article, language }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-article-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
