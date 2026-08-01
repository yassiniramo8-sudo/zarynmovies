import { useScrollRestoration } from "@/hooks/useScrollRestoration";

/**
 * Global route-change handler.
 * - On PUSH/REPLACE navigation: scrolls to top (new page).
 * - On POP (back/forward) navigation: restores the saved scroll position
 *   from sessionStorage after the target page content has mounted.
 * - Cleans up any iframe-injected body styles that may have leaked past the
 *   navigation guard (overflow:hidden, position:fixed, etc.).
 * - Ensures body scroll is always enabled after leaving the detail page.
 */
export const ScrollToTop = () => {
  useScrollRestoration();
  return null;
};