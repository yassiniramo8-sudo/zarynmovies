import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_LANGUAGES = ["ar", "en", "fr", "es"];
const LANG_NAMES: Record<string, string> = { ar: "Arabic", en: "English", fr: "French", es: "Spanish" };

// Content types where title should NOT be translated
const NO_TITLE_TRANSLATION: string[] = [];

async function translateText(
  texts: { title: string; description: string; genre?: string[] },
  fromLang: string,
  toLang: string,
  skipTitle: boolean
): Promise<{ title: string; description: string; genre?: string[] } | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const titleInstruction = skipTitle
    ? `DO NOT translate the title — keep it exactly as provided.`
    : `Translate the title naturally. Keep proper nouns (names, places) transliterated.`;

  const genreInstruction = texts.genre?.length
    ? `Also translate the array of genre keywords to ${LANG_NAMES[toLang]}. Keep them as comma-separated short keywords.`
    : `If genre is provided as an array, translate each keyword. Otherwise leave it empty.`;

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
            content: `You are a professional translator. Translate from ${LANG_NAMES[fromLang] || fromLang} to ${LANG_NAMES[toLang]}. ${titleInstruction} ${genreInstruction} Return ONLY JSON with "title", "description" and "genre" keys. "genre" must be an array of translated keywords. Preserve meaning and tone.`,
          },
          {
            role: "user",
            content: `Title: ${texts.title}\nDescription: ${texts.description.substring(0, 3000)}\nGenre: ${(texts.genre || []).join(", ")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_translation",
              description: "Return translated content",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  genre: {
                    type: "array",
                    items: { type: "string" },
                    description: "Translated genre keywords",
                  },
                },
                required: ["title", "description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_translation" } },
      }),
    });

    if (!response.ok) {
      console.error(`Translation to ${toLang} failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return {
        title: parsed.title,
        description: parsed.description,
        genre: Array.isArray(parsed.genre) ? parsed.genre : undefined,
      };
    }
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
    const { contentId, contentType, title, description, genre, targetLanguage, forceTranslate } = body;

    if (!contentId || !contentType || !title) {
      return new Response(JSON.stringify({ error: "contentId, contentType, and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skipTitle = NO_TITLE_TRANSLATION.includes(contentType);
    const isNews = contentType === "sports_news";

    // Detect original language
    const arabicRegex = /[\u0600-\u06FF]/g;
    const arabicChars = ((title + " " + (description || "")).match(arabicRegex) || []).length;
    const originalLang = arabicChars > (title + " " + (description || "")).length * 0.3 ? "ar" : "en";

    // Determine which languages to translate
    let langsToTranslate: string[];
    if (targetLanguage && forceTranslate) {
      langsToTranslate = [targetLanguage];
    } else {
      // Check existing translations
      let existingLangs: Set<string>;
      if (isNews) {
        const { data: existing } = await supabase
          .from("news_translations")
          .select("language")
          .eq("news_id", contentId);
        existingLangs = new Set((existing || []).map((t: any) => t.language));
      } else {
        const { data: existing } = await supabase
          .from("content_translations")
          .select("language")
          .eq("content_id", contentId)
          .eq("content_type", contentType);
        existingLangs = new Set((existing || []).map((t: any) => t.language));
      }
      existingLangs.add(originalLang);
      langsToTranslate = TARGET_LANGUAGES.filter(l => !existingLangs.has(l));
    }

    if (langsToTranslate.length === 0) {
      return new Response(JSON.stringify({ translated: 0, message: "All translations exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toInsertContent: any[] = [];
    const toInsertNews: any[] = [];

    const promises = langsToTranslate.map(async (lang) => {
      const result = await translateText(
        { title, description: description || "", genre: Array.isArray(genre) ? genre : [] },
        originalLang,
        lang,
        skipTitle
      );
      if (result) {
        if (isNews) {
          toInsertNews.push({
            news_id: contentId,
            language: lang,
            title: result.title,
            excerpt: result.description?.substring(0, 500) || "",
            content: result.description,
          });
        } else {
          toInsertContent.push({
            content_id: contentId,
            content_type: contentType,
            language: lang,
            title: skipTitle ? title : result.title,
            description: result.description,
            genre: Array.isArray(result.genre) && result.genre.length > 0 ? result.genre : null,
          });
        }
      }
    });

    await Promise.all(promises);

    if (toInsertContent.length > 0) {
      const { error } = await supabase
        .from("content_translations")
        .upsert(toInsertContent, { onConflict: "content_id,content_type,language", ignoreDuplicates: false });
      if (error) {
        console.error("Insert error:", error.message);
        for (const item of toInsertContent) {
          await supabase.from("content_translations").upsert(item);
        }
      }
    }

    if (toInsertNews.length > 0) {
      const { error } = await supabase
        .from("news_translations")
        .upsert(toInsertNews, { onConflict: "news_id,language", ignoreDuplicates: false });
      if (error) {
        console.error("News insert error:", error.message);
        for (const item of toInsertNews) {
          await supabase.from("news_translations").upsert(item);
        }
      }
    }

    const totalTranslated = toInsertContent.length + toInsertNews.length;
    return new Response(
      JSON.stringify({ translated: totalTranslated, contentId, contentType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});