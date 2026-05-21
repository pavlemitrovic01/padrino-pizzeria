import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  define: {
    // Inject Vercel's git commit SHA at build time so it appears in monitoring logs.
    // Locally (no VERCEL_GIT_COMMIT_SHA): resolves to "unknown".
    // On Vercel: resolves to the actual deploy SHA (system env var, automatic).
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    ),
  },
  build: {
    rollupOptions: {
      // ✅ Multi-page entry (pravi HTML za SEO landing)
      input: {
        main: resolve(__dirname, "index.html"),
        pizzaBudva: resolve(__dirname, "pizza-budva.html"),
      },
      output: {
        // ✅ Stabilno chunkovanje bez menjanja aplikacije/dizajna
        // Cilj: smanjiti i ubrzati parse/execute glavnog "index" chunka na mobile
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // React core
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react";
          }

          // Supabase SDK
          if (id.includes("@supabase/")) {
            return "supabase";
          }

          // Icons (često ume da poraste)
          if (id.includes("lucide-react")) {
            return "icons";
          }

          // Sve ostalo iz node_modules
          return "vendor";
        },
      },
    },
    // (opciono) Ako želiš da ukloniš warning za 500kb, ali nije potrebno:
    // chunkSizeWarningLimit: 650,
  },
});