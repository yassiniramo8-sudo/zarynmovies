import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    // Verify admin role
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleData || []).map((r: any) => r.role);
    if (!roles.includes("super_admin") && !roles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { message } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Gather site stats for context
    const [moviesRes, animeRes, seriesRes, articlesRes, viewsRes, downloadsRes, usersRes, commentsRes] = await Promise.all([
      adminClient.from("movies").select("id", { count: "exact", head: true }),
      adminClient.from("anime").select("id", { count: "exact", head: true }),
      adminClient.from("series").select("id", { count: "exact", head: true }),
      adminClient.from("articles").select("id", { count: "exact", head: true }),
      adminClient.from("content_views").select("id", { count: "exact", head: true }),
      adminClient.from("content_downloads").select("id", { count: "exact", head: true }),
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient.from("comments").select("id", { count: "exact", head: true }),
    ]);

    // Recent views for today count
    const { data: recentViews } = await adminClient
      .from("content_views")
      .select("content_type, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const todayViews = (recentViews || []).filter(
      (v: any) => new Date(v.created_at).toDateString() === new Date().toDateString()
    ).length;

    const systemContext = `You are the AI Admin Assistant for "Zaryn Movies" streaming platform.
You are multilingual - you MUST respond in the SAME LANGUAGE as the user's message. If they write in Arabic, respond in Arabic. If in English, respond in English. If in French, respond in French, etc.

Current site statistics:
- Movies: ${moviesRes.count || 0}
- Anime: ${animeRes.count || 0}
- Series: ${seriesRes.count || 0}  
- Articles: ${articlesRes.count || 0}
- Total Views: ${viewsRes.count || 0}
- Today's Views: ${todayViews}
- Total Downloads: ${downloadsRes.count || 0}
- Registered Users: ${usersRes.count || 0}
- Total Comments: ${commentsRes.count || 0}

Tech stack: React + Vite + Supabase (Lovable Cloud). Database: PostgreSQL.

You help the admin with:
- Website health monitoring and diagnostics
- Performance insights and optimization suggestions
- Content management recommendations
- SEO optimization tips
- Database and query optimization
- Security recommendations
- User engagement analysis
- Detecting and suggesting fixes for broken links, missing content, layout issues
- Multi-device display consistency checks

Always respond with detailed, actionable technical insights. Use markdown formatting with headers, bullet points, and code blocks where appropriate.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    // Log the chat
    await adminClient.from("ai_chat_logs").insert({ user_id: userId, message });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-admin-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
