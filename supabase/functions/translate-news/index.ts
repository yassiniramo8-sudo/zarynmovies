import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_LANGUAGES = ["ar", "en", "fr", "es"];
const LANG_NAMES: Record<string, string> = { ar: "Arabic", en: "English", fr: "French", es: "Spanish" };

function detectLanguage(text: string): string {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const arabicChars = (text.match(arabicRegex) || []).length;
  if (arabicChars > text.length * 0.3) return "ar";
  
  // Simple heuristic for French/Spanish vs English
  const frWords = ["le", "la", "les", "des", "du", "un", "une", "est", "dans", "pour", "avec", "sur", "par", "cette", "être", "sont", "aux", "qui", "que", "nous", "vous"];
  const esWords = ["el", "la", "los", "las", "un", "una", "es", "en", "del", "por", "con", "para", "como", "más", "pero", "sus", "está", "son", "tiene", "este"];
  
  const words = text.toLowerCase().split(/\s+/);
  const frCount = words.filter(w => frWords.includes(w)).length;
  const esCount = words.filter(w => esWords.includes(w)).length;
  const ratio = words.length > 0 ? 1 / words.length : 0;
  
  if (frCount * ratio > 0.05 && frCount > esCount) return "fr";
  if (esCount * ratio > 0.05 && esCount > frCount) return "es";
  return "en";
}

async function translateToLanguages(
  items: Array<{ title: string; excerpt: string; content: string }>,
  fromLang: string,
  toLangs: string[]
): Promise<Record<string, Array<{ title: string; excerpt: string; content: string }>>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || items.length === 0 || toLangs.length === 0) return {};

  const results: Record<string, Array<{ title: string; excerpt: string; content: string }>> = {};

  // Translate to each target language in parallel
  const promises = toLangs.map(async (lang) => {
    const langName = LANG_NAMES[lang] || lang;
    const prompt = items.map((item, i) =>
      `[${i}] Title: ${item.title}\nExcerpt: ${item.excerpt}\nContent: ${item.content.substring(0, 2000)}`
    ).join("\n---\n");

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
            {
              role: "system",
              content: `You are a professional news translator. Translate these news items from ${LANG_NAMES[fromLang] || fromLang} to ${langName}. Return ONLY a JSON array where each element has "title", "excerpt", and "content" keys. Keep translations accurate, natural, and preserve journalistic tone. No extra text.`,
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translations",
                description: "Return translated items",
                parameters: {
                  type: "object",
                  properties: {
                    translations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          excerpt: { type: "string" },
                          content: { type: "string" },
                        },
                        required: ["title", "excerpt", "content"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["translations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_translations" } },
        }),
      });

      if (!response.ok) {
        console.error(`Translation to ${lang} failed: ${response.status}`);
        return;
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        results[lang] = parsed.translations || [];
      }
    } catch (e) {
      console.error(`Translation to ${lang} error:`, e);
    }
  });

  await Promise.all(promises);
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { newsIds, translateAll } = body;

    // Get articles to translate
    let query = supabase.from("sports_news").select("id, title, title_ar, excerpt, excerpt_ar, content, content_ar");
    
    if (newsIds?.length) {
      query = query.in("id", newsIds);
    } else if (translateAll) {
      // Get articles that don't have translations yet
      const { data: existingTranslations } = await supabase
        .from("news_translations")
        .select("news_id")
        .limit(1000);
      
      const translatedIds = new Set((existingTranslations || []).map((t: any) => t.news_id));
      
      query = query.eq("status", "published").order("published_at", { ascending: false }).limit(50);
      const { data: allArticles } = await query;
      const untranslated = (allArticles || []).filter((a: any) => !translatedIds.has(a.id));
      
      if (untranslated.length === 0) {
        return new Response(JSON.stringify({ translated: 0, message: "All articles already translated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Process untranslated articles
      return await processArticles(supabase, untranslated);
    }

    const { data: articles, error } = await query;
    if (error) throw error;
    if (!articles?.length) {
      return new Response(JSON.stringify({ translated: 0, message: "No articles found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return await processArticles(supabase, articles);
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processArticles(supabase: any, articles: any[]) {
  let totalTranslated = 0;

  // Process in batches of 5
  for (let i = 0; i < articles.length; i += 5) {
    const batch = articles.slice(i, i + 5);

    for (const article of batch) {
      // Detect original language
      const originalText = article.title + " " + (article.content || article.excerpt || "");
      const detectedLang = detectLanguage(originalText);

      // Determine which languages need translation
      const { data: existingTrans } = await supabase
        .from("news_translations")
        .select("language")
        .eq("news_id", article.id);

      const existingLangs = new Set((existingTrans || []).map((t: any) => t.language));
      // Also consider the original language as "already available"
      existingLangs.add(detectedLang);
      // If we have ar content natively, mark it
      if (article.title_ar) existingLangs.add("ar");

      const needsTranslation = TARGET_LANGUAGES.filter(l => !existingLangs.has(l));
      if (needsTranslation.length === 0) continue;

      // Prepare source content
      const sourceTitle = detectedLang === "ar" ? (article.title_ar || article.title) : article.title;
      const sourceExcerpt = detectedLang === "ar" ? (article.excerpt_ar || article.excerpt || "") : (article.excerpt || "");
      const sourceContent = detectedLang === "ar" ? (article.content_ar || article.content || "") : (article.content || "");

      const translations = await translateToLanguages(
        [{ title: sourceTitle, excerpt: sourceExcerpt, content: sourceContent }],
        detectedLang,
        needsTranslation
      );

      // Also store the original language version
      const toInsert: any[] = [];

      // Store original as a translation too if not already there
      if (!existingLangs.has(detectedLang) || detectedLang === "ar") {
        // Already have native, skip
      }

      for (const [lang, trans] of Object.entries(translations)) {
        if (trans[0]) {
          toInsert.push({
            news_id: article.id,
            language: lang,
            title: trans[0].title,
            excerpt: trans[0].excerpt,
            content: trans[0].content,
          });
        }
      }

      // Also store native English as translation if detected as English
      if (detectedLang === "en" && !existingLangs.has("en")) {
        toInsert.push({
          news_id: article.id,
          language: "en",
          title: article.title,
          excerpt: article.excerpt || "",
          content: article.content || "",
        });
      }
      // Store native Arabic
      if (detectedLang === "ar" && !existingLangs.has("ar") && article.title_ar) {
        toInsert.push({
          news_id: article.id,
          language: "ar",
          title: article.title_ar || article.title,
          excerpt: article.excerpt_ar || article.excerpt || "",
          content: article.content_ar || article.content || "",
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("news_translations").upsert(toInsert, { onConflict: "news_id,language" });
        if (error) {
          console.error(`Translation insert error for ${article.id}:`, error.message);
        } else {
          totalTranslated += toInsert.length;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ translated: totalTranslated, articles: articles.length }),
    { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version", "Content-Type": "application/json" } }
  );
}
