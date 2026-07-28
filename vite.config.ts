import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    proxy: {
      "/sitemap.xml": {
        target: "https://zjlsmwcrenzdvdkfyhdx.supabase.co",
        changeOrigin: true,
        rewrite: () => "/functions/v1/generate-sitemap",
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    cssMinify: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
      },
      format: { comments: false },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-popover", "@radix-ui/react-select"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-motion": ["framer-motion"],
          "vendor-charts": ["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
}));
