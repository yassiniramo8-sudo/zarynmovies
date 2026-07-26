import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTrackView(contentId: string | undefined, contentType: string) {
  useEffect(() => {
    if (!contentId || !contentType) return;

    const trackView = async () => {
      try {
        // Get a simple fingerprint from the session
        const sessionKey = `viewed_${contentType}_${contentId}`;
        if (sessionStorage.getItem(sessionKey)) return; // Already tracked this session

        await supabase.from("content_views").insert({
          content_type: contentType,
          content_id: contentId,
          user_ip: null, // Privacy-friendly: we track via session instead
        });

        sessionStorage.setItem(sessionKey, "1");
      } catch {
        // Silent fail for tracking
      }
    };

    trackView();
  }, [contentId, contentType]);
}
