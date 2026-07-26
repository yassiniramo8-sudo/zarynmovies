import { supabase } from "@/integrations/supabase/client";

export async function trackDownload(contentId: string, contentType: string, downloadLink: string) {
  try {
    await supabase.from("content_downloads").insert({
      content_type: contentType,
      content_id: contentId,
      download_link: downloadLink,
      user_ip: null,
    });
  } catch {
    // Silent fail
  }
}
