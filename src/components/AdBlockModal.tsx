import { ShieldAlert, Ban, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export function AdBlockModal() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-xl"
      style={{ pointerEvents: "all" }}
    >
      <div className="relative mx-4 max-w-lg w-full">
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-2xl gradient-brand opacity-20 blur-xl" />

        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="relative rounded-2xl border border-border/50 bg-card/90 backdrop-blur-md p-8 text-center shadow-2xl"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30"
          >
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </motion.div>

          {/* Title */}
          <h2 className="mb-3 font-display text-2xl font-bold text-foreground md:text-3xl">
            Ad Blocker Detected
          </h2>

          {/* Message */}
          <p className="mb-6 text-muted-foreground leading-relaxed">
            Ads help us keep <span className="text-gradient-brand font-semibold">Zaryn Movies</span> free
            for everyone. Please disable your ad blocker to continue enjoying
            our content.
          </p>

          {/* Blocked features */}
          <div className="mb-8 space-y-3">
            {[
              "Video playback is disabled",
              "Comments & likes are restricted",
              "Content browsing is blocked",
            ].map((text, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground"
              >
                <Ban className="h-4 w-4 shrink-0 text-destructive" />
                {text}
              </motion.div>
            ))}
          </div>

          {/* Steps */}
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-foreground">
              How to disable your ad blocker:
            </p>
            <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
              <li>Click the ad blocker icon in your browser toolbar</li>
              <li>
                Select{" "}
                <span className="font-medium text-foreground">
                  "Disable on this site"
                </span>{" "}
                or{" "}
                <span className="font-medium text-foreground">
                  "Pause"
                </span>
              </li>
              <li>Refresh the page</li>
            </ol>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            I've Disabled It — Refresh
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
