import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";

const DB_TABLES = [
  "movies", "anime", "anime_groups", "series", "episodes",
  "articles", "highlights", "sports_news",
  "comments", "comment_likes", "likes", "user_ratings",
  "polls", "poll_votes",
  "advertisements", "backgrounds",
  "profiles", "user_roles", "user_subscriptions",
  "subscription_plans", "subscription_requests", "payment_methods",
  "contact_messages", "notifications", "email_campaigns",
  "site_settings", "sitemap_urls",
  "content_views", "content_downloads",
  "referral_codes", "referrals",
  "watch_history", "watch_later",
  "user_bans", "user_ad_settings",
  "ai_chat_logs", "ai_moderation_log", "ai_site_logs",
  "admin_permissions", "archived_users",
] as const;

type ProgressCallback = (message: string, percent: number) => void;

async function fetchAllRows(table: string) {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.warn(`Error fetching ${table}:`, error.message);
      return allRows;
    }
    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allRows;
}

async function fetchStorageFiles(zip: JSZip, onProgress: ProgressCallback) {
  const buckets = ["content", "avatars"];
  
  for (const bucket of buckets) {
    const { data: files, error } = await supabase.storage.from(bucket).list("", { limit: 500 });
    if (error || !files) continue;

    const mediaFolder = zip.folder(`media/${bucket}`)!;

    for (const file of files) {
      if (file.id === null) continue; // skip folders at root
      try {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(file.name);
        const resp = await fetch(urlData.publicUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          mediaFolder.file(file.name, blob);
          onProgress(`Downloaded media: ${bucket}/${file.name}`, 0);
        }
      } catch {
        console.warn(`Skipped file ${bucket}/${file.name}`);
      }
    }
  }
}

export async function exportSiteBackup(onProgress: ProgressCallback): Promise<void> {
  const zip = new JSZip();
  const totalSteps = DB_TABLES.length + 2; // tables + media + finalize
  let step = 0;

  // 1. Export database tables
  const dbFolder = zip.folder("database")!;
  for (const table of DB_TABLES) {
    step++;
    onProgress(`Exporting table: ${table}...`, Math.round((step / totalSteps) * 80));
    const rows = await fetchAllRows(table);
    dbFolder.file(`${table}.json`, JSON.stringify(rows, null, 2));
  }

  // 2. Export media/storage files
  step++;
  onProgress("Downloading media files...", Math.round((step / totalSteps) * 80));
  await fetchStorageFiles(zip, onProgress);

  // 3. Add a README
  zip.file("README.md", `# Site Backup\n\nExported on: ${new Date().toISOString()}\n\n## Structure\n- \`database/\` — All database tables as JSON\n- \`media/\` — Uploaded images and files\n\n## Restore\nImport JSON files into your database and upload media files to your storage.\n`);

  // 4. Generate and download
  onProgress("Generating ZIP file...", 90);
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: true,
  }, (meta) => {
    onProgress(`Compressing... ${meta.percent.toFixed(0)}%`, 90 + Math.round(meta.percent / 10));
  });

  const filename = `site-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(blob, filename);
  onProgress("Backup complete!", 100);
}
