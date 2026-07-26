import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { comment_text, comment_id } = await req.json();
    if (!comment_text) {
      return new Response(JSON.stringify({ allowed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // If no AI key, allow all comments
      return new Response(JSON.stringify({ allowed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if moderation is enabled
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: setting } = await adminClient.from("site_settings").select("value").eq("key", "ai_comment_moderation").single();
    if (setting?.value !== "true") {
      return new Response(JSON.stringify({ allowed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
            content: `You are a comment moderation AI. Analyze the comment for:
1. Toxic language, hate speech, slurs
2. Spam (repeated text, promotional links, excessive caps)
3. Harassment or threats
4. Sexually explicit content

Respond ONLY with a JSON object using tool calling.`
          },
          { role: "user", content: `Moderate this comment: "${comment_text}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "moderation_result",
            description: "Return moderation analysis",
            parameters: {
              type: "object",
              properties: {
                allowed: { type: "boolean", description: "Whether the comment should be allowed" },
                reason: { type: "string", description: "Brief reason if blocked" },
                confidence: { type: "number", description: "Confidence 0-1" },
                category: { type: "string", enum: ["clean", "toxic", "spam", "harassment", "explicit"] },
              },
              required: ["allowed", "reason", "confidence", "category"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "moderation_result" } },
      }),
    });

    if (!response.ok) {
      console.error("AI moderation failed, allowing comment");
      return new Response(JSON.stringify({ allowed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let result = { allowed: true, reason: "", confidence: 0, category: "clean" };
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = { allowed: true, reason: "", confidence: 0, category: "clean" };
      }
    }

    // Log moderation action if flagged
    if (!result.allowed && comment_id) {
      await adminClient.from("ai_moderation_log").insert({
        comment_id,
        action: "blocked",
        reason: `${result.category}: ${result.reason}`,
        confidence: result.confidence,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderation error:", e);
    return new Response(JSON.stringify({ allowed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
