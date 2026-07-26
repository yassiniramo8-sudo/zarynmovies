import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ThemeSettings {
  backgroundImage?: string;
  backgroundGradient?: string;
  navBg?: string;
  navText?: string;
  primaryColor?: string;
  secondaryColor?: string;
  headingColor?: string;
  buttonBg?: string;
  buttonText?: string;
  vipBackgroundGradient?: string;
  vipBackgroundEnabled?: boolean;
}

const DEFAULT_THEME: ThemeSettings = {};

export function useThemeSettings() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  const fetchTheme = useCallback(async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "theme_settings")
      .single();
    if (data?.value) {
      try {
        setTheme(JSON.parse(data.value));
      } catch {
        setTheme(DEFAULT_THEME);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  const saveTheme = async (newTheme: ThemeSettings) => {
    setTheme(newTheme);
    await supabase
      .from("site_settings")
      .update({ value: JSON.stringify(newTheme), updated_at: new Date().toISOString() })
      .eq("key", "theme_settings");
  };

  return { theme, loading, saveTheme, refetch: fetchTheme };
}

const DEFAULT_VIP_GRADIENT = "linear-gradient(135deg, hsl(43 80% 8%) 0%, hsl(38 70% 14%) 25%, hsl(45 60% 10%) 50%, hsl(30 65% 12%) 75%, hsl(50 55% 8%) 100%)";

/** Apply theme settings as CSS custom properties on document root */
export function applyThemeToDOM(theme: ThemeSettings, isVip = false) {
  const root = document.documentElement;

  // VIP background override
  const useVipBg = isVip && theme.vipBackgroundEnabled !== false;
  
  // Add smooth transition
  document.body.style.transition = "background 0.8s ease-in-out";

  if (useVipBg) {
    const vipGradient = theme.vipBackgroundGradient || DEFAULT_VIP_GRADIENT;
    document.body.style.backgroundImage = "none";
    document.body.style.background = vipGradient;
    document.body.style.backgroundAttachment = "fixed";
    root.style.setProperty("--vip-active", "1");
  } else if (theme.backgroundImage) {
    document.body.style.backgroundImage = `url(${theme.backgroundImage})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.backgroundRepeat = "no-repeat";
    root.style.removeProperty("--vip-active");
  } else if (theme.backgroundGradient) {
    document.body.style.backgroundImage = "none";
    document.body.style.background = theme.backgroundGradient;
    document.body.style.backgroundAttachment = "fixed";
    root.style.removeProperty("--vip-active");
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.background = "";
    root.style.removeProperty("--vip-active");
  }

  // CSS custom properties for colors
  if (theme.navBg) root.style.setProperty("--theme-nav-bg", theme.navBg);
  else root.style.removeProperty("--theme-nav-bg");

  if (theme.navText) root.style.setProperty("--theme-nav-text", theme.navText);
  else root.style.removeProperty("--theme-nav-text");

  if (theme.headingColor) root.style.setProperty("--theme-heading", theme.headingColor);
  else root.style.removeProperty("--theme-heading");

  if (theme.primaryColor) {
    // Convert hex to HSL for CSS variable
    const hsl = hexToHSLValues(theme.primaryColor);
    if (hsl) root.style.setProperty("--primary", hsl);
  } else {
    root.style.removeProperty("--primary");
  }

  if (theme.secondaryColor) {
    const hsl = hexToHSLValues(theme.secondaryColor);
    if (hsl) root.style.setProperty("--secondary", hsl);
  } else {
    root.style.removeProperty("--secondary");
  }

  if (theme.buttonBg) root.style.setProperty("--theme-button-bg", theme.buttonBg);
  else root.style.removeProperty("--theme-button-bg");

  if (theme.buttonText) root.style.setProperty("--theme-button-text", theme.buttonText);
  else root.style.removeProperty("--theme-button-text");
}

function hexToHSLValues(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
