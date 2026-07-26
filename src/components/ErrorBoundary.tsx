import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label shown in the default fallback. */
  name?: string;
  /** If true, render null instead of a UI fallback on error. */
  silent?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Local error boundary. Isolates a single feature module so that a crash
 * inside it (ads, player, comments, etc.) does not take the whole page down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep noise low in production; log once with the module name for grep-ability.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.silent) return null;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Something went wrong{this.props.name ? ` in ${this.props.name}` : ""}.</div>
          <div className="text-destructive/80 text-xs mt-1">This section failed to load, but the rest of the page is still working.</div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
