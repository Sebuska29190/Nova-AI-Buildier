import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          lucide: ["lucide-react"],
          flow: ["@xyflow/react"],
          marked: ["marked", "dompurify", "highlight.js"],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
