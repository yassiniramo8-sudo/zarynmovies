import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserBan } from "@/hooks/useUserBan";
import { toast } from "sonner";

export function useLikes(contentId: string, contentType: string) {
  const { isBanned, remainingText } = useUserBan();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  const fetch = useCallback(async () => {
    if (!contentId) return;
    const { count: c } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("content_id", contentId)
      .eq("content_type", contentType);
    setCount(c || 0);

    if (user) {
      const { data } = await supabase
        .from("likes")
        .select("id")
        .eq("content_id", contentId)
        .eq("content_type", contentType)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!data);
    }
  }, [contentId, contentType, user]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggle = async () => {
    if (!user) { toast.error("Sign in to like"); return; }
    if (isBanned) { toast.error(`You are temporarily restricted. ${remainingText || ""}`); return; }
    if (liked) {
      await supabase.from("likes").delete()
        .eq("content_id", contentId)
        .eq("content_type", contentType)
        .eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({
        content_id: contentId,
        content_type: contentType,
        user_id: user.id,
      });
    }
    setLiked(!liked);
    setCount((c) => liked ? c - 1 : c + 1);
  };

  return { liked, count, toggle };
}
