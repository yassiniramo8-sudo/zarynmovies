import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { subject, body, target_audience } = await req.json();

    if (!subject || !body) {
      return new Response(JSON.stringify({ error: "Missing subject or body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user emails
    let userIds: string[] = [];
    if (target_audience === "vip") {
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .gte("expires_at", new Date().toISOString());
      userIds = (subs || []).map((s: any) => s.user_id);
    } else if (target_audience === "non_vip") {
      const { data: allProfiles } = await supabase.from("profiles").select("id");
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .gte("expires_at", new Date().toISOString());
      const vipIds = new Set((subs || []).map((s: any) => s.user_id));
      userIds = (allProfiles || []).filter((p: any) => !vipIds.has(p.id)).map((p: any) => p.id);
    } else {
      const { data: allProfiles } = await supabase.from("profiles").select("id");
      userIds = (allProfiles || []).map((p: any) => p.id);
    }

    // Get emails from auth
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const targetEmails = (users || [])
      .filter((u: any) => userIds.includes(u.id) && u.email)
      .map((u: any) => u.email);

    if (!resendKey || targetEmails.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: resendKey ? "No recipients" : "RESEND_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send in batches of 50
    let sentCount = 0;
    for (let i = 0; i < targetEmails.length; i += 50) {
      const batch = targetEmails.slice(i, i + 50);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Zaryn Movies <onboarding@resend.dev>",
          to: batch,
          subject,
          html: body,
        }),
      });
      if (res.ok) sentCount += batch.length;
      await res.text();
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
