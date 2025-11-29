import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": "https://bandwidth-master-37z1.vercel.app",
      "/media": "https://bandwidth-master-37z1.vercel.app/media",
      "/ping-1mb.bin": "https://bandwidth-master-37z1.vercel.app",
    },
  },
});
