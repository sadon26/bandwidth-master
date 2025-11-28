import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/media": "http://localhost:3001/media",
      "/ping-1mb.bin": "http://localhost:3001",
    },
  },
});
