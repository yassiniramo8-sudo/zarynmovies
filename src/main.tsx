import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPreviewFromWindow, isPreviewMode } from "@/lib/adPreview";
import { installNavigationGuard } from "@/lib/navigationGuard";

// Install navigation guard at app boot — blocks iframe-initiated
// history.back() / history.go(-1) from DoodStream and other providers.
installNavigationGuard();

// Bootstrap Ad Live Preview when opened inside the preview iframe.
initPreviewFromWindow();

// Register service worker for stale-while-revalidate caching.
// Skip inside preview mode so cached HTML never masks the injected preview.
if ("serviceWorker" in navigator && !isPreviewMode()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);