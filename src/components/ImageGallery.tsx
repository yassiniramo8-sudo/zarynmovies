import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!images.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => setLightboxIdx(i)}
            className="overflow-hidden rounded-lg border border-border/50 aspect-video group"
          >
            <img
              src={url}
              alt={`${title} gallery ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Dialog open={lightboxIdx !== null} onOpenChange={() => setLightboxIdx(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 border-border/50 gap-0">
          {lightboxIdx !== null && (
            <div className="relative">
              <img
                src={images[lightboxIdx]}
                alt={`${title} gallery`}
                className="w-full max-h-[80vh] object-contain"
              />
              <button onClick={() => setLightboxIdx(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-background/70 text-foreground hover:bg-background">
                <X className="h-5 w-5" />
              </button>
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx - 1 + images.length) % images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/70 text-foreground hover:bg-background"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/70 text-foreground hover:bg-background"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/70 px-2 py-1 rounded-full">
                {lightboxIdx + 1} / {images.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
