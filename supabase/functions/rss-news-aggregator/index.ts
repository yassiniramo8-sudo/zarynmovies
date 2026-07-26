import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractCDATA(text: string): string {
  const cdataMatch = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return cdataMatch ? cdataMatch[1].trim() : text.replace(/<[^>]+>/g, "").trim();
}

function parseRSSItems(xml: string): Array<{
  title: string;
  description: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
  category: string | null;
}> {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
      const m = itemXml.match(r);
      return m ? extractCDATA(m[1]) : "";
    };

    const title = getTag("title");
    const description = getTag("description");
    const link = getTag("link");
    const pubDate = getTag("pubDate");
    const category = getTag("category") || null;

    let imageUrl: string | null = null;
    const mediaMatch = itemXml.match(/url=["']([^"']+\.(jpg|jpeg|png|webp|gif)[^"']*)/i);
    if (mediaMatch) imageUrl = mediaMatch[1];
    if (!imageUrl) {
      const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) imageUrl = imgMatch[1];
    }
    const enclosureMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i);
    if (!imageUrl && enclosureMatch) imageUrl = enclosureMatch[1];

    if (title) {
      items.push({ title, description: description.replace(/<[^>]+>/g, "").substring(0, 500), link, pubDate, imageUrl, category });
    }
  }
  return items;
}

function detectCategory(title: string, desc: string, sourceCategory?: string): string {
  // If the source already has a strong category, prefer it
  const strongCategories = ["anime", "entertainment", "technology", "Sports"];
  if (sourceCategory && strongCategories.includes(sourceCategory.toLowerCase()) || strongCategories.includes(sourceCategory || "")) {
    // Still check text for anime vs entertainment disambiguation
    const text = (title + " " + desc).toLowerCase();
    if (sourceCategory?.toLowerCase() === "entertainment") {
      const animeKeywords = ["anime", "manga", "otaku", "crunchyroll", "funimation", "shonen", "shojo", "isekai", "light novel", "أنيمي", "مانجا"];
      if (animeKeywords.some(k => text.includes(k))) return "anime";
    }
    if (sourceCategory?.toLowerCase() === "anime") return "anime";
    if (sourceCategory === "Sports") return "Sports";
    if (sourceCategory?.toLowerCase() === "technology") return "Technology";
    if (sourceCategory?.toLowerCase() === "entertainment") return "Entertainment";
  }

  const text = (title + " " + desc).toLowerCase();
  const map: Record<string, string[]> = {
    Technology: ["tech", "technology", "تقنية", "تكنولوجيا", "ai", "artificial intelligence", "ذكاء اصطناعي", "machine learning", "deep learning", "startup", "شركة ناشئة", "software", "برمجة", "hardware", "chip", "microchip", "semiconductor", "processor", "gpu", "cpu", "robot", "robotics", "cyber", "cybersecurity", "أمن سيبراني", "cloud computing", "saas", "smartphone", "هاتف ذكي", "gadget", "iphone", "nvidia", "openai", "chatgpt", "gemini", "llm", "gpt", "copilot", "quantum", "5g", "6g", "blockchain", "crypto", "bitcoin", "ethereum", "vr headset", "metaverse", "iot", "drone", "spacex", "satellite", "إلكترونيات", "semiconductor", "wafer", "tsmc", "intel", "amd", "qualcomm", "arm chip", "neural", "generative ai", "diffusion", "transformer model"],
    Sports: ["sport", "رياضة", "football", "soccer", "كرة القدم", "match", "مباراة", "goal", "هدف", "league", "دوري", "fifa", "olympic", "nba", "nfl", "champion", "tournament", "transfer", "penalty", "referee", "stadium", "world cup", "كأس العالم", "premier league", "la liga", "bundesliga", "serie a", "ligue 1", "champions league", "europa league", "african cup", "كأس أفريقيا", "saudi pro league", "botola", "البطولة", "tennis", "boxing", "mma", "ufc", "basketball", "rugby", "cricket", "f1", "formula", "ballon d'or", "golden boot", "var", "offside", "midfielder", "striker", "goalkeeper", "winger", "hat-trick", "assist", "red card", "yellow card", "الدوري", "المنتخب"],
    anime: ["anime", "أنيمي", "manga", "مانجا", "otaku", "أوتاكو", "crunchyroll", "funimation", "myanimelist", "anilist", "shonen", "shojo", "seinen", "josei", "isekai", "light novel", "livechart", "kitsu", "toei animation", "studio ghibli", "mappa", "wit studio", "ufotable", "madhouse", "bones studio", "trigger", "a-1 pictures", "kyoto animation", "naruto", "one piece", "dragon ball", "jujutsu", "demon slayer", "attack on titan", "chainsaw man", "spy x family", "bleach", "hunter x hunter", "my hero academia", "solo leveling"],
    Entertainment: ["movie", "film", "فيلم", "سينما", "cinema", "actor", "actress", "ممثل", "drama", "مسلسل", "netflix", "disney", "hbo", "trailer", "box office", "oscar", "emmy", "golden globe", "streaming", "premiere", "sequel", "remake", "reboot", "cast", "director", "screenplay", "marvel", "dc", "pixar", "studio", "tv show", "season", "episode", "blockbuster", "thriller", "horror", "comedy", "action", "sci-fi", "fantasy", "documentary", "biopic", "romantic", "عرض أول", "مشاهدة", "تحميل", "shahid", "prime video", "hulu", "paramount", "sony pictures", "warner bros", "universal", "lionsgate", "a24", "indie film"],
    Politics: ["politic", "سياس", "election", "انتخاب", "president", "رئيس", "parliament", "برلمان", "government", "حكوم", "diplomat", "sanction", "geopolit", "summit", "united nations", "أمم متحدة"],
    Economy: ["econom", "اقتصاد", "market", "سوق", "stock", "بورصة", "trade", "تجار", "inflation", "تضخم", "bank", "بنك", "gdp", "recession", "interest rate", "federal reserve"],
    Health: ["health", "صح", "medical", "طب", "hospital", "مستشفى", "vaccine", "لقاح", "disease", "مرض", "who", "pandemic", "clinical trial"],
    Science: ["science", "علم", "space", "فضاء", "nasa", "research", "بحث", "discover", "اكتشاف", "telescope", "mars", "moon landing", "particle physics"],
    Culture: ["culture", "ثقاف", "art", "فن", "music", "موسيقى", "book", "كتاب", "heritage", "تراث", "album", "concert", "exhibition"],
  };

  for (const [cat, keywords] of Object.entries(map)) {
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return "General";
}

function detectLanguage(text: string): "ar" | "en" {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  const arabicChars = (text.match(new RegExp(arabicRegex.source, "g")) || []).length;
  return arabicChars > text.length * 0.3 ? "ar" : "en";
}

async function translateBatch(items: Array<{ title: string; excerpt: string }>, fromLang: "ar" | "en"): Promise<Array<{ title: string; excerpt: string }>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || items.length === 0) return items.map(() => ({ title: "", excerpt: "" }));

  const toLang = fromLang === "ar" ? "English" : "Arabic";
  const prompt = items.map((item, i) => `[${i}] Title: ${item.title}\nExcerpt: ${item.excerpt}`).join("\n---\n");

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
            content: `You are a professional translator. Translate the following news items to ${toLang}. Return ONLY a JSON array where each element has "title" and "excerpt" keys. Keep translations accurate and natural. No extra text.`,
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
                      },
                      required: ["title", "excerpt"],
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
      console.error("Translation API error:", response.status);
      return items.map(() => ({ title: "", excerpt: "" }));
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.translations || items.map(() => ({ title: "", excerpt: "" }));
    }
    return items.map(() => ({ title: "", excerpt: "" }));
  } catch (e) {
    console.error("Translation error:", e);
    return items.map(() => ({ title: "", excerpt: "" }));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { sourceId, fetchAll } = body;

    let query = supabase.from("news_sources").select("*").eq("active", true);
    if (sourceId) query = query.eq("id", sourceId);
    const { data: sources, error: srcErr } = await query;
    if (srcErr) throw srcErr;
    if (!sources?.length) {
      return new Response(JSON.stringify({ fetched: 0, message: "No active sources" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalFetched = 0;
    const results: any[] = [];
    const errors: string[] = [];

    for (const source of sources) {
      try {
        console.log(`Fetching RSS: ${source.name} — ${source.url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(source.url, {
          signal: controller.signal,
          headers: { "User-Agent": "ZarynMovies-Bot/1.0" },
        });
        clearTimeout(timeout);

        if (!res.ok) {
          errors.push(`${source.name}: HTTP ${res.status}`);
          continue;
        }

        const xml = await res.text();
        const items = parseRSSItems(xml);
        console.log(`${source.name}: ${items.length} items found`);

        const { data: existing } = await supabase
          .from("sports_news")
          .select("title")
          .eq("source_name", source.name)
          .order("created_at", { ascending: false })
          .limit(100);

        const existingTitles = new Set((existing || []).map((e: any) => e.title.toLowerCase().trim()));
        const newItems = items.filter(item => !existingTitles.has(item.title.toLowerCase().trim()));
        const batch = newItems.slice(0, fetchAll ? 50 : 10);

        // Detect language and translate batch
        const sourceLang = source.language === "ar" ? "ar" as const : "en" as const;
        const toTranslate = batch.map(item => ({ title: item.title, excerpt: item.description.substring(0, 200) }));
        const translations = await translateBatch(toTranslate, sourceLang);

        const toInsert = batch.map((item, idx) => {
          const cat = item.category || detectCategory(item.title, item.description, source.category);
          const trans = translations[idx] || { title: "", excerpt: "" };

          return {
            title: item.title,
            title_ar: sourceLang === "ar" ? item.title : (trans.title || null),
            content: item.description,
            content_ar: sourceLang === "ar" ? item.description : (trans.excerpt || null),
            excerpt: sourceLang === "en" ? item.description.substring(0, 200) : (trans.excerpt || item.description.substring(0, 200)),
            excerpt_ar: sourceLang === "ar" ? item.description.substring(0, 200) : (trans.excerpt || null),
            image_url: item.imageUrl,
            source_url: item.link,
            source_name: source.name,
            category: cat,
            tags: [source.category, source.language].filter(Boolean),
            status: "draft",
            ai_generated: false,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          };
        });

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from("sports_news").insert(toInsert);
          if (insErr) {
            errors.push(`${source.name}: Insert error — ${insErr.message}`);
          } else {
            totalFetched += toInsert.length;
          }
        }

        await supabase.from("news_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", source.id);
        results.push({ source: source.name, found: items.length, new: toInsert.length });

        // Trigger auto-translation for newly inserted articles
        if (toInsert.length > 0) {
          try {
            // Get the IDs of newly inserted articles
            const { data: newArticles } = await supabase
              .from("sports_news")
              .select("id")
              .eq("source_name", source.name)
              .order("created_at", { ascending: false })
              .limit(toInsert.length);
            
            if (newArticles?.length) {
              const newsIds = newArticles.map((a: any) => a.id);
              // Fire and forget — don't block the RSS import
              fetch(`${supabaseUrl}/functions/v1/translate-news`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ newsIds }),
              }).catch(e => console.error("Auto-translate trigger error:", e));
            }
          } catch (e) {
            console.error("Auto-translate trigger error:", e);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        errors.push(`${source.name}: ${msg}`);
        console.error(`Error fetching ${source.name}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ fetched: totalFetched, results, errors }),
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
