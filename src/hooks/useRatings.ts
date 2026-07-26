import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useRatings(contentId: string, contentType: string) {
  const { user } = useAuth();
  const [averageRating, setAverageRating] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchRatings = useCallback(async () => {
    if (!contentId) return;
    
    const { data: ratings } = await supabase
      .from("user_ratings")
      .select("rating, user_id")
      .eq("content_id", contentId)
      .eq("content_type", contentType);

    if (ratings) {
      setTotalRatings(ratings.length);
      const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
      setAverageRating(Math.round(avg * 10) / 10);
      if (user) {
        const mine = ratings.find((r) => r.user_id === user.id);
        setUserRating(mine?.rating || 0);
      }
    }
    setLoading(false);
  }, [contentId, contentType, user]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const rate = async (rating: number) => {
    if (!user) { toast.error("Sign in to rate"); return; }

    if (userRating > 0) {
      await supabase
        .from("user_ratings")
        .update({ rating, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .eq("content_type", contentType);
    } else {
      await supabase.from("user_ratings").insert({
        user_id: user.id,
        content_id: contentId,
        content_type: contentType,
        rating,
      });
    }

    setUserRating(rating);
    fetchRatings();
    toast.success(`Rated ${rating}/5`);
  };

  return { averageRating, userRating, totalRatings, loading, rate };
}
