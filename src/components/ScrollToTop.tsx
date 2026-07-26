import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Global route-change handler.
 * - Scrolls to top on every navigation.
 * - Cleans up any iframe-injected body styles that may have leaked past the
 *   navigation guard (overflow:hidden, position:fixed, etc.).
 * - Ensures body scroll is always enabled after leaving the detail page.
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);

    // Belt-and-suspenders: force-clean any leaked body styles from iframe scripts.
    // The navigationGuard handles this in real-time while the detail page is mounted,
    // but if a script fires right as the route changes, we catch it here.
    const body = document.body;
    body.style.overflow = "";
    body.style.overflowX = "";
    body.style.overflowY = "";
    body.style.position = "";
    body.style.height = "";
    body.style.minHeight = "";
    body.style.width = "";
    body.style.minWidth = "";
    body.style.maxWidth = "";
    body.style.inset = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.bottom = "";
    body.style.margin = "";
    body.style.marginTop = "";
    body.style.padding = "";
  }, [pathname]);

  return null;
};
