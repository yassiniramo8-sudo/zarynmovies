import { useEffect, useRef, useState, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode[];
  gap?: number;
  className?: string;
  cardWidthClass?: string;
}

/** Netflix-style momentum carousel: snap, drag, wheel, keyboard, hover-scale ready. */
export function PremiumCarousel({ children, gap = 16, className, cardWidthClass = "w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px]" }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);
  const drag = useRef<{ startX: number; startLeft: number; active: boolean; moved: boolean }>({ startX: 0, startLeft: 0, active: false, moved: false });
  const DRAG_THRESHOLD = 8; // px minimum movement before activating drag

  const update = () => {
    const el = scroller.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);

  const scrollBy = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: "smooth" });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollBy(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollBy(-1); }
  };

  const onDown = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!el) return;
    // Only capture if the target is the scroller itself or a non-interactive child
    // This allows clicks on links/buttons inside cards to pass through
    drag.current = { startX: e.clientX, startLeft: el.scrollLeft, active: false, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!el) return;
    const dx = Math.abs(e.clientX - drag.current.startX);
    // Activate drag only after threshold is exceeded
    if (!drag.current.active && dx > DRAG_THRESHOLD) {
      drag.current.active = true;
      drag.current.moved = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    }
    if (drag.current.active) {
      el.scrollLeft = drag.current.startLeft - (e.clientX - drag.current.startX);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (drag.current.active) {
      try { scroller.current?.releasePointerCapture(e.pointerId); } catch {}
      if (scroller.current) scroller.current.style.cursor = "";
    }
    drag.current.active = false;
    drag.current.moved = false;
  };

  return (
    <div className={cn("group/carousel relative", className)} tabIndex={0} onKeyDown={onKey}>
      {canL && (
        <Button
          size="icon" variant="secondary"
          onClick={() => scrollBy(-1)}
          className="absolute left-1 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur opacity-0 shadow-xl transition-opacity group-hover/carousel:opacity-100 md:flex"
          aria-label="Scroll left"
        ><ChevronLeft className="h-5 w-5" /></Button>
      )}
      {canR && (
        <Button
          size="icon" variant="secondary"
          onClick={() => scrollBy(1)}
          className="absolute right-1 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur opacity-0 shadow-xl transition-opacity group-hover/carousel:opacity-100 md:flex"
          aria-label="Scroll right"
        ><ChevronRight className="h-5 w-5" /></Button>
      )}
      <div
        ref={scroller}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ gap, touchAction: "pan-y" }}
      >
        {children.map((child, i) => (
          <div key={i} className={cn("shrink-0 snap-start", cardWidthClass)}>{child}</div>
        ))}
      </div>
    </div>
  );
}
