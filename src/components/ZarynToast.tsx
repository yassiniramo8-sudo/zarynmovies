import { Crown, Shield, Bell, Info, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Button } from "@/components/ui/button";

type NotifType = "vip" | "admin" | "success" | "error" | "warning" | "info";

interface ZarynToastOptions {
  title: string;
  message?: string;
  type?: NotifType;
  duration?: number;
  action?: { label: string; onClick: () => void };
  cancel?: { label: string; onClick: () => void };
}

const iconMap: Record<NotifType, React.ReactNode> = {
  vip: <Crown className="h-5 w-5 text-amber-400" />,
  admin: <Shield className="h-5 w-5 text-primary" />,
  success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
  error: <XCircle className="h-5 w-5 text-destructive" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  info: <Bell className="h-5 w-5 text-primary" />,
};

const borderMap: Record<NotifType, string> = {
  vip: "border-l-amber-400",
  admin: "border-l-primary",
  success: "border-l-emerald-400",
  error: "border-l-destructive",
  warning: "border-l-amber-500",
  info: "border-l-primary",
};

export function zarynToast(opts: ZarynToastOptions) {
  const type = opts.type || "info";

  return sonnerToast.custom(
    (id) => (
      <div
        className={`w-[360px] rounded-xl border border-border/40 border-l-4 ${borderMap[type]} bg-card/95 backdrop-blur-xl shadow-2xl shadow-background/40 overflow-hidden animate-fade-in ${
          type === "vip" ? "ring-1 ring-amber-400/20" : ""
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              type === "vip"
                ? "bg-gradient-to-br from-amber-500/20 to-yellow-400/20"
                : "bg-primary/10"
            }`}
          >
            {iconMap[type]}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold leading-tight ${
                type === "vip"
                  ? "bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent"
                  : "text-foreground"
              }`}
            >
              {opts.title}
            </p>
            {opts.message && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {opts.message}
              </p>
            )}
            {(opts.action || opts.cancel) && (
              <div className="mt-3 flex items-center gap-2">
                {opts.action && (
                  <Button
                    size="sm"
                    className={`h-7 text-xs ${
                      type === "vip"
                        ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-600 hover:to-yellow-500"
                        : ""
                    }`}
                    onClick={() => {
                      opts.action!.onClick();
                      sonnerToast.dismiss(id);
                    }}
                  >
                    {opts.action.label}
                  </Button>
                )}
                {opts.cancel && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      opts.cancel!.onClick();
                      sonnerToast.dismiss(id);
                    }}
                  >
                    {opts.cancel.label}
                  </Button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(id)}
            className="shrink-0 rounded p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    ),
    { duration: opts.duration || 5000 }
  );
}

/** Confirmation toast that replaces browser confirm() */
export function zarynConfirm(opts: {
  title: string;
  message?: string;
  type?: NotifType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  return zarynToast({
    title: opts.title,
    message: opts.message,
    type: opts.type || "admin",
    duration: 15000,
    action: {
      label: opts.confirmLabel || "Confirm",
      onClick: opts.onConfirm,
    },
    cancel: {
      label: opts.cancelLabel || "Cancel",
      onClick: opts.onCancel || (() => {}),
    },
  });
}
