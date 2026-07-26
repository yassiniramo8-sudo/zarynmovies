import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COUNTRY_SOURCES: Record<string, string> = {
  usa: "Hollywood, US entertainment industry, American cinema, Netflix, Disney, Warner Bros",
  japan: "Japanese anime industry, Studio Ghibli, Toei Animation, Japanese cinema, J-drama",
  korea: "Korean drama (K-drama), Korean cinema, K-pop entertainment, CJ Entertainment, Korean Wave (Hallyu)",
  france: "French cinema, Cannes Film Festival, Canal+, French entertainment industry",
  india: "Bollywood, Indian cinema, Tollywood, Indian entertainment, streaming in India",
  uk: "British cinema, BBC, British entertainment, BAFTA",
  global: "international cinema, global entertainment, worldwide box office, streaming platforms worldwide",
  turkey: "Turkish drama (Dizi), Turkish cinema, Turkish entertainment industry",
  spain: "Spanish cinema, La Casa de Papel, Spanish entertainment",
  germany: "German cinema, Berlinale, German entertainment industry",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, language, country, newsType } = await req.json();
    if (!topic) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const langInstruction = language === "ar"
      ? "Write the main content in Arabic. Also provide English translations."
      : language === "fr"
      ? "Write the main content in French. Also provide Arabic and English translations."
      : language === "es"
      ? "Write the main content in Spanish. Also provide Arabic and English translations."
      : "Write the main content in English. Also provide Arabic translations.";

    const countryContext = country && COUNTRY_SOURCES[country.toLowerCase()]
      ? `Focus on news sources and content from: ${COUNTRY_SOURCES[country.toLowerCase()]}. Prioritize news and developments from this region.`
      : "";

    const newsTypeInstruction = newsType === "daily"
      ? "Generate a timely, breaking-news style article covering the latest developments from today."
      : newsType === "weekly"
      ? "Generate a weekly roundup or analysis article summarizing the most important events of the week."
      : "";

    const prompt = `You are an expert journalist, SEO specialist, and content strategist. The admin wants to create a news article about: "${topic}"

${langInstruction}

${countryContext}

${newsTypeInstruction}

Search your entire knowledge for the latest and most relevant information about this topic. This is a UNIVERSAL news platform — the topic can be about anything: politics, sports, technology, economy, entertainment, science, health, international affairs, national news, culture, or any other subject.

Generate a complete, professional, engaging news article.

Return a JSON object with these fields:
- title: SEO-optimized title in the primary language (under 70 chars)
- title_ar: Arabic title
- content: Full article body in the primary language (400-800 words, well-structured with paragraphs, include relevant context and analysis)
- content_ar: Full article body in Arabic
- excerpt: Short summary (under 200 chars) in the primary language
- excerpt_ar: Short summary in Arabic
- category: One of [Politics, Sports, Technology, Economy, Entertainment, Science, Health, International, National, Culture, Breaking News, Opinion, Environment, Education, Business, General]
- tags: Array of 5-8 relevant tags/keywords for SEO
- seo_title: SEO title under 60 chars
- seo_description: Meta description under 160 chars
- seo_keywords: Comma-separated keywords for maximum Google traffic
- source_name: "AI Generated"
- source_country: The country/region focus of this article
- detected_language: The language detected from the admin's input

Make the content engaging, factual, well-researched, and optimized for search engines.
Return ONLY valid JSON, no markdown fences.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || "{}";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("AI returned invalid response");
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
