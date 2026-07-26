import { useState, useEffect } from "react";

export function useAdBlockDetector() {
  const [adBlockDetected, setAdBlockDetected] = useState(false);

  useEffect(() => {
    const detect = async () => {
      let blocked = false;

      // Method 1: Try to fetch a fake ad script
      try {
        const response = await fetch(
          "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
          { method: "HEAD", mode: "no-cors", cache: "no-store" }
        );
        // no-cors fetch won't throw on block in all browsers, so also check method 2
      } catch {
        blocked = true;
      }

      // Method 2: Create a bait element that ad blockers typically hide
      if (!blocked) {
        const bait = document.createElement("div");
        bait.className =
          "ad_unit ad-zone ad-space adsbox ad-placeholder textads banner-ads";
        bait.setAttribute("id", "ad-test-bait");
        bait.style.cssText =
          "position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;";
        bait.innerHTML = "&nbsp;";
        document.body.appendChild(bait);

        // Wait a tick for ad blockers to act
        await new Promise((r) => setTimeout(r, 150));

        if (
          bait.offsetParent === null ||
          bait.offsetHeight === 0 ||
          bait.offsetWidth === 0 ||
          getComputedStyle(bait).display === "none" ||
          getComputedStyle(bait).visibility === "hidden"
        ) {
          blocked = true;
        }
        bait.remove();
      }

      // Method 3: Try creating an ad-like script
      if (!blocked) {
        try {
          const script = document.createElement("script");
          script.src =
            "https://pagead2.googlesyndication.com/pagead/show_ads.js";
          script.onerror = () => {
            blocked = true;
            setAdBlockDetected(true);
          };
          document.head.appendChild(script);
          await new Promise((r) => setTimeout(r, 300));
          script.remove();
        } catch {
          blocked = true;
        }
      }

      setAdBlockDetected(blocked);
    };

    detect();
  }, []);

  return adBlockDetected;
}
