import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
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
