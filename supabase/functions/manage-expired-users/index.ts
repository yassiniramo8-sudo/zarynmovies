import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isSuperAdmin && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, user_ids, archive, notify, reason } = body;

    if (!action || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Missing action or user_ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { deleted: 0, archived: 0, revoked: 0, notified: 0, errors: [] as string[] };

    if (action === "delete") {
      for (const uid of user_ids) {
        try {
          // Get profile and subscription info for archive
          if (archive) {
            const { data: profile } = await supabaseAdmin.from("profiles").select("username, avatar_url").eq("id", uid).single();
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid);
            const { data: sub } = await supabaseAdmin
              .from("user_subscriptions")
              .select("expires_at, plan:subscription_plans(name)")
              .eq("user_id", uid)
              .order("expires_at", { ascending: false })
              .limit(1)
              .single();

            await supabaseAdmin.from("archived_users").insert({
              original_user_id: uid,
              username: profile?.username || null,
              email: authUser?.user?.email || null,
              avatar_url: profile?.avatar_url || null,
              subscription_plan: (sub?.plan as any)?.name || null,
              subscription_expired_at: sub?.expires_at || null,
              was_vip: sub ? new Date(sub.expires_at) > new Date() : false,
              archived_by: user.id,
              reason: reason || "Expired subscription cleanup",
            });
            results.archived++;
          }

          // Send notification before delete if requested
          if (notify) {
            await supabaseAdmin.from("notifications").insert({
              user_id: uid,
              title: "Account Notice",
              message: reason || "Your account has been scheduled for removal due to expired subscription.",
            });
            results.notified++;
          }

          // Clean up related data
          await supabaseAdmin.from("notifications").delete().eq("user_id", uid);
          await supabaseAdmin.from("watch_later").delete().eq("user_id", uid);
          await supabaseAdmin.from("watch_history").delete().eq("user_id", uid);
          await supabaseAdmin.from("likes").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_ratings").delete().eq("user_id", uid);
          await supabaseAdmin.from("comment_likes").delete().eq("user_id", uid);
          await supabaseAdmin.from("comments").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_subscriptions").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_ad_settings").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_bans").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
          await supabaseAdmin.from("admin_permissions").delete().eq("user_id", uid);
          await supabaseAdmin.from("profiles").delete().eq("id", uid);

          // Delete auth user
          const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
          if (authErr) throw authErr;

          results.deleted++;
        } catch (e: any) {
          results.errors.push(`${uid}: ${e.message}`);
        }
      }
    } else if (action === "revoke_vip") {
      for (const uid of user_ids) {
        try {
          // Expire all subscriptions
          await supabaseAdmin
            .from("user_subscriptions")
            .update({ expires_at: new Date().toISOString() })
            .eq("user_id", uid);

          // Re-enable ads
          await supabaseAdmin
            .from("user_ad_settings")
            .update({ ads_enabled: true, adblock_enforcement: true })
            .eq("user_id", uid);

          if (notify) {
            await supabaseAdmin.from("notifications").insert({
              user_id: uid,
              title: "VIP Status Changed",
              message: reason || "Your VIP membership has been revoked by an administrator.",
              link: "/subscribe",
            });
            results.notified++;
          }

          results.revoked++;
        } catch (e: any) {
          results.errors.push(`${uid}: ${e.message}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
