import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Counts {
  likes: number;
  comments: number;
}

export function useContentCounts(contentId: string, contentType: string): Counts {
  const [counts, setCounts] = useState<Counts>({ likes: 0, comments: 0 });

  useEffect(() => {
    if (!contentId) return;
    Promise.all([
      supabase.from("likes").select("*", { count: "exact", head: true }).eq("content_id", contentId).eq("content_type", contentType),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("content_id", contentId).eq("content_type", contentType),
    ]).then(([likesRes, commentsRes]) => {
      setCounts({ likes: likesRes.count || 0, comments: commentsRes.count || 0 });
    });
  }, [contentId, contentType]);

  return counts;
}
