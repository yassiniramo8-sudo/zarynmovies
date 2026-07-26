import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_LANGUAGES = ["ar", "en", "fr", "es"];
const LANG_NAMES: Record<string, string> = { ar: "Arabic", en: "English", fr: "French", es: "Spanish" };

// Content types where title should NOT be translated
const NO_TITLE_TRANSLATION = ["movie", "series", "anime"];

function detectLanguage(text: string): string {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const arabicChars = (text.match(arabicRegex) || []).length;
  if (arabicChars > text.length * 0.3) return "ar";
  const frWords = ["le","la","les","des","du","un","une","est","dans","pour","avec","sur","par","cette","sont","aux","qui","que"];
  const esWords = ["el","la","los","las","un","una","es","en","del","por","con","para","como","más","pero","sus","está","son"];
  const words = text.toLowerCase().split(/\s+/);
  const frCount = words.filter(w => frWords.includes(w)).length;
  const esCount = words.filter(w => esWords.includes(w)).length;
  const ratio = words.length > 0 ? 1 / words.length : 0;
  if (frCount * ratio > 0.05 && frCount > esCount) return "fr";
  if (esCount * ratio > 0.05 && esCount > frCount) return "es";
  return "en";
}

async function translateText(
  text: string,
  fromLang: string,
  toLang: string,
  format: "title_desc" | "news"
): Promise<any | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const isNews = format === "news";
  const systemPrompt = isNews
    ? `You are a professional news translator. Translate from ${LANG_NAMES[fromLang] || fromLang} to ${LANG_NAMES[toLang]}. Return ONLY JSON with "title", "excerpt", "content" keys. Preserve journalistic tone.`
    : `You are a professional translator. Translate from ${LANG_NAMES[fromLang] || fromLang} to ${LANG_NAMES[toLang]}. Return ONLY JSON with "title" and "description" keys. Preserve meaning and tone.`;

  const toolParams = isNews
    ? { title: { type: "string" }, excerpt: { type: "string" }, content: { type: "string" } }
    : { title: { type: "string" }, description: { type: "string" } };
  const required = isNews ? ["title", "excerpt", "content"] : ["title", "description"];

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text.substring(0, 4000) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_translation",
            description: "Return translated content",
            parameters: {
              type: "object",
              properties: toolParams,
              required,
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_translation" } },
      }),
    });

    if (!response.ok) {
      console.error(`Translation to ${toLang} failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error(`Translation error:`, e);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 10;
    const stats = { news: 0, movies: 0, series: 0, anime: 0 };

    // ─── 1. Auto-translate NEWS ───
    {
      // Get all published news IDs
      const { data: allNews } = await supabase
        .from("sports_news")
        .select("id, title, title_ar, excerpt, excerpt_ar, content, content_ar")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(200);

      if (allNews?.length) {
        // Get existing translations
        const { data: existingTrans } = await supabase
          .from("news_translations")
          .select("news_id, language")
          .in("news_id", allNews.map((n: any) => n.id));

        // Build map: newsId -> set of translated languages
        const transMap: Record<string, Set<string>> = {};
        (existingTrans || []).forEach((t: any) => {
          if (!transMap[t.news_id]) transMap[t.news_id] = new Set();
          transMap[t.news_id].add(t.language);
        });

        // Find news needing translation
        const needsWork: any[] = [];
        for (const article of allNews) {
          const existing = transMap[article.id] || new Set();
          // Native ar fields count
          if (article.title_ar) existing.add("ar");
          const originalLang = detectLanguage(article.title + " " + (article.content || ""));
          existing.add(originalLang);
          const missing = TARGET_LANGUAGES.filter(l => !existing.has(l));
          if (missing.length > 0) needsWork.push({ article, originalLang, missing });
        }

        // Process batch
        for (const { article, originalLang, missing } of needsWork.slice(0, batchSize)) {
          const sourceTitle = originalLang === "ar" ? (article.title_ar || article.title) : article.title;
          const sourceExcerpt = originalLang === "ar" ? (article.excerpt_ar || article.excerpt || "") : (article.excerpt || "");
          const sourceContent = originalLang === "ar" ? (article.content_ar || article.content || "") : (article.content || "");

          const toInsert: any[] = [];
          for (const lang of missing) {
            const prompt = `Title: ${sourceTitle}\nExcerpt: ${sourceExcerpt}\nContent: ${sourceContent}`;
            const result = await translateText(prompt, originalLang, lang, "news");
            if (result) {
              toInsert.push({
                news_id: article.id,
                language: lang,
                title: result.title,
                excerpt: result.excerpt || "",
                content: result.content || "",
              });
            }
          }

          if (toInsert.length > 0) {
            await supabase.from("news_translations").upsert(toInsert, { onConflict: "news_id,language" });
            stats.news += toInsert.length;
          }
        }
      }
    }

    // ─── 2. Auto-translate MOVIES / SERIES / ANIME ───
    const contentTables = [
      { table: "movies", type: "movie" },
      { table: "series", type: "series" },
      { table: "anime", type: "anime" },
    ] as const;

    for (const { table, type } of contentTables) {
      const { data: items } = await supabase
        .from(table)
        .select("id, title, description")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!items?.length) continue;

      // Get existing translations
      const { data: existingTrans } = await supabase
        .from("content_translations")
        .select("content_id, language")
        .eq("content_type", type)
        .in("content_id", items.map((i: any) => i.id));

      const transMap: Record<string, Set<string>> = {};
      (existingTrans || []).forEach((t: any) => {
        if (!transMap[t.content_id]) transMap[t.content_id] = new Set();
        transMap[t.content_id].add(t.language);
      });

      const needsWork: any[] = [];
      for (const item of items) {
        const existing = transMap[item.id] || new Set();
        const originalLang = detectLanguage(item.title + " " + (item.description || ""));
        existing.add(originalLang);
        const missing = TARGET_LANGUAGES.filter(l => !existing.has(l));
        if (missing.length > 0 && item.description) {
          needsWork.push({ item, originalLang, missing });
        }
      }

      // Process batch
      for (const { item, originalLang, missing } of needsWork.slice(0, batchSize)) {
        const skipTitle = NO_TITLE_TRANSLATION.includes(type);
        const toInsert: any[] = [];

        for (const lang of missing) {
          const prompt = skipTitle
            ? `Title: ${item.title}\nDescription: ${item.description}`
            : `Title: ${item.title}\nDescription: ${item.description}`;

          const result = await translateText(prompt, originalLang, lang, "title_desc");
          if (result) {
            toInsert.push({
              content_id: item.id,
              content_type: type,
              language: lang,
              title: skipTitle ? item.title : (result.title || item.title),
              description: result.description || "",
            });
          }
        }

        if (toInsert.length > 0) {
          await supabase.from("content_translations").upsert(toInsert, {
            onConflict: "content_id,content_type,language",
            ignoreDuplicates: false,
          });
          stats[type as keyof typeof stats] += toInsert.length;
        }
      }
    }

    const total = stats.news + stats.movies + stats.series + stats.anime;
    console.log(`Auto-translate completed: ${JSON.stringify(stats)}`);

    return new Response(
      JSON.stringify({ success: true, total, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Auto-translate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
