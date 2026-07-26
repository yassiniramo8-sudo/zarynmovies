import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleCheck } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });
    const { data: modCheck } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const { data: permCheck } = await supabaseAdmin.rpc("has_permission", {
      _user_id: user.id,
      _permission: "manage_movies",
    });

    if (!roleCheck && !modCheck && !permCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      content_type,
      content_id,
      title,
      description,
      poster_url,
      send_email,
    } = body;

    if (!content_type || !content_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const typeMap: Record<string, string> = {
      movie: "movies",
      anime: "anime",
      article: "articles",
      background: "backgrounds",
    };
    const link = `/${typeMap[content_type] || "movies"}/${content_id}`;

    // Get all user IDs (excluding the admin who created it)
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .neq("id", user.id);

    const userIds = profiles?.map((p) => p.id) || [];

    // Insert in-app notifications in batches of 500
    const notifications = userIds.map((uid) => ({
      user_id: uid,
      title: `New ${content_type}: ${title}`,
      message: description
        ? description.substring(0, 120)
        : `A new ${content_type} has been added!`,
      link,
      image_url: poster_url || null,
    }));

    for (let i = 0; i < notifications.length; i += 500) {
      const batch = notifications.slice(i, i + 500);
      await supabaseAdmin.from("notifications").insert(batch);
    }

    // Send emails via Resend if toggled
    let emailsSent = 0;
    if (send_email) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        // Get user emails
        const {
          data: { users: allUsers },
        } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const emails = allUsers
          ?.filter((u) => u.email && u.id !== user.id)
          .map((u) => u.email!) || [];

        // Send in batches of 50
        for (let i = 0; i < emails.length; i += 50) {
          const batch = emails.slice(i, i + 50);
          try {
            await fetch("https://api.resend.com/emails/batch", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(
                batch.map((email) => ({
                  from: "Zaryn <onboarding@resend.dev>",
                  to: email,
                  subject: `New on Zaryn: ${title}`,
                  html: `
                    <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#e6edf3;border-radius:16px;overflow:hidden">
                      ${poster_url ? `<img src="${poster_url}" alt="${title}" style="width:100%;max-height:300px;object-fit:cover" />` : ""}
                      <div style="padding:24px">
                        <h1 style="color:#7cc832;margin:0 0 12px;font-size:24px">${title}</h1>
                        <p style="color:#8b949e;line-height:1.6;margin:0 0 24px">${description ? description.substring(0, 200) : `A new ${content_type} has been added to Zaryn!`}</p>
                        <a href="https://zaryn.lovable.app${link}" style="display:inline-block;background:linear-gradient(135deg,#7cc832,#e09f3e);color:#0d1117;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Watch Now</a>
                      </div>
                    </div>
                  `,
                }))
              ),
            });
            emailsSent += batch.length;
          } catch (e) {
            console.error("Email batch error:", e);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: userIds.length,
        emails_sent: emailsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
