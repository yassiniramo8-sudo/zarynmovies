/**
 * CENTRALIZED REALTIME MANAGER
 *
 * Every Supabase realtime subscription across the entire application must go
 * through this singleton. It prevents duplicate channels, duplicate listeners,
 * memory leaks, race conditions during login/logout, and crashes caused by
 * channel recreation storms.
 *
 * Usage:
 *   import { realtimeManager } from "@/lib/realtimeManager";
 *
 *   // Subscribe (safe to call multiple times — no-ops if already subscribed)
 *   const unsub = realtimeManager.subscribe("my-channel", {
 *     tables: [{ schema: "public", table: "movies" }],
 *     onChange: () => fetchMovies(),
 *     debounceMs: 400,  // optional, default 300
 *   });
 *
 *   // Clean up (component unmount or when auth state changes)
 *   useEffect(() => () => unsub(), []);
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface SubscriptionConfig {
  /** Tables to listen to (postgres_changes * events) */
  tables: { schema: string; table: string }[];
  /** Called when a change is detected (already debounced) */
  onChange: () => void;
  /** Debounce window in ms (default 300) */
  debounceMs?: number;
  /** Optional filter for postgres_changes */
  filter?: string;
}

interface ActiveSubscription {
  channel: RealtimeChannel;
  config: SubscriptionConfig;
  refCount: number;
  timer: ReturnType<typeof setTimeout> | null;
  onChangeInternal: () => void;
}

class RealtimeManager {
  private subscriptions = new Map<string, ActiveSubscription>();
  private disposed = false;

  /**
   * Subscribe to realtime changes on one or more tables.
   * Safe to call multiple times with the same key — ref counts and no-ops.
   * Returns an unsubscribe function. Unsubscribe removes the listener,
   * but the channel stays open until all listeners are removed.
   */
  subscribe(key: string, config: SubscriptionConfig): () => void {
    if (this.disposed) {
      console.warn("[RealtimeManager] Manager is disposed, cannot subscribe:", key);
      return () => {};
    }

    const existing = this.subscriptions.get(key);

    if (existing) {
      // Already subscribed — bump ref count and update the callback
      existing.refCount++;
      existing.config = config;
      existing.onChangeInternal = () => {
        if (existing.config.onChange) existing.config.onChange();
      };
      console.debug("[RealtimeManager] Reusing existing subscription:", key, "refCount:", existing.refCount);
      return () => this._unsubscribe(key);
    }

    // Build debounced change handler
    const debounceMs = config.debounceMs ?? 300;
    const onEvent = () => {
      const sub = this.subscriptions.get(key);
      if (!sub) return;
      if (sub.timer) clearTimeout(sub.timer);
      sub.timer = setTimeout(() => {
        sub.timer = null;
        if (this.subscriptions.has(key)) {
          sub.onChangeInternal();
        }
      }, debounceMs);
    };

    // Create channel
    const channelName = `realtime-${key}`;
    const channel = supabase.channel(channelName);

    config.tables.forEach((t) => {
      const filterObj: any = { event: "*", schema: t.schema, table: t.table };
      if (config.filter) filterObj.filter = config.filter;
      channel.on("postgres_changes", filterObj, () => onEvent());
    });

    // Subscribe
    channel.subscribe((status: string) => {
      if (status === "CHANNEL_ERROR") {
        console.error("[RealtimeManager] Channel error:", key);
      }
    });

    const sub: ActiveSubscription = {
      channel,
      config,
      refCount: 1,
      timer: null,
      onChangeInternal: () => {
        if (config.onChange) config.onChange();
      },
    };

    this.subscriptions.set(key, sub);
    console.debug("[RealtimeManager] Created subscription:", key);
    return () => this._unsubscribe(key);
  }

  private _unsubscribe(key: string) {
    const existing = this.subscriptions.get(key);
    if (!existing) return;

    existing.refCount--;
    if (existing.refCount > 0) {
      console.debug("[RealtimeManager] Unsub one listener, remaining:", key, existing.refCount);
      return;
    }

    // All listeners gone — clean up fully
    console.debug("[RealtimeManager] Removing subscription:", key);
    if (existing.timer) clearTimeout(existing.timer);
    try {
      supabase.removeChannel(existing.channel);
    } catch (err) {
      console.warn("[RealtimeManager] Error removing channel:", key, err);
    }
    this.subscriptions.delete(key);
  }

  /**
   * Called when auth state changes (login/logout).
   * Removes all subscriptions so they can be recreated with the new session.
   */
  resetAll() {
    console.debug("[RealtimeManager] Resetting all subscriptions (auth change)");
    this.subscriptions.forEach((sub, key) => {
      if (sub.timer) clearTimeout(sub.timer);
      try {
        supabase.removeChannel(sub.channel);
      } catch (err) {
        console.warn("[RealtimeManager] Error removing channel during reset:", key, err);
      }
    });
    this.subscriptions.clear();
  }

  /** For debugging — returns count of active subscriptions */
  get activeCount() {
    return this.subscriptions.size;
  }

  /** Dispose the entire manager (e.g., during app teardown) */
  dispose() {
    this.disposed = true;
    this.subscriptions.forEach((sub, key) => {
      if (sub.timer) clearTimeout(sub.timer);
      try {
        supabase.removeChannel(sub.channel);
      } catch {
        // ignore
      }
    });
    this.subscriptions.clear();
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();

// Export class for testing
export { RealtimeManager };