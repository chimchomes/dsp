import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure worker file is copied to dist
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "pdf.worker.min.mjs") {
            return "pdf.worker.min.mjs";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  publicDir: "public",
});
