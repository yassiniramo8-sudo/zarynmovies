import { Button } from "@/components/ui/button";
import { Download, HardDrive } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackDownload } from "@/hooks/useTrackDownload";
import { useVipStatus } from "@/hooks/useVip";
import { UniversalPlayer, IFRAME_ALLOW } from "@/components/player/UniversalPlayer";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";

interface Server {
  name: string;
  url: string;
  quality?: string;
  size?: string;
  access_level?: "public" | "vip";
  type?: string;
  language?: string;
  status?: "active" | "inactive";
}

interface ServerSelectorProps {
  watchServers?: Server[];
  downloadServers?: Server[];
  contentId?: string;
  contentType?: string;
  isVip?: boolean;
}

// Re-export for backwards compatibility with any existing imports.
export const STREAM_IFRAME_ALLOW = IFRAME_ALLOW;

export function ServerSelector({
  watchServers = [],
  downloadServers = [],
  contentId,
  contentType,
  isVip = false,
}: ServerSelectorProps) {
  const { t } = useLanguage();
  const { isVip: vipFromHook } = useVipStatus();
  const effectiveVip = isVip || vipFromHook;

  const filteredWatch = effectiveVip
    ? watchServers
    : watchServers.filter((s) => s.access_level !== "vip");
  const filteredDownload = effectiveVip
    ? downloadServers
    : downloadServers.filter((s) => s.access_level !== "vip");

  if (!filteredWatch.length && !filteredDownload.length) return null;

  return (
    <div className="space-y-6">
      {filteredWatch.length > 0 && (
        <>
          <AdvertisementRenderer placement="above_player" />
          <UniversalPlayer
            servers={filteredWatch}
            storageKey={contentId ? `${contentType}:${contentId}` : undefined}
          />
          <AdvertisementRenderer placement="below_player" />
        </>
      )}

      {filteredDownload.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <HardDrive className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {t("servers.downloadServers")}
            </span>
          </div>
          <div className="p-4 space-y-2">
            {filteredDownload.map((server, i) => (
              <a
                key={i}
                href={server.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (contentId && contentType) trackDownload(contentId, contentType, server.url);
                }}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-3 hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {server.name || `Download ${i + 1}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {server.quality && (
                        <span className="text-xs text-primary font-medium">{server.quality}</span>
                      )}
                      {server.size && (
                        <span className="text-xs text-muted-foreground">• {server.size}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground group-hover:text-primary transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Download</span>
                </Button>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
