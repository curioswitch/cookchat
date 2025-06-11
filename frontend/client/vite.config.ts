import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react({}), tailwindcss()],
  server: {
    port: process.env.PORT ? Number.parseInt(process.env.PORT) : 8080,
    proxy: {
      "/frontendapi.FrontendService": {
        target:
          process.env.SERVICE_FRONTEND ??
          "https://alpha.cookchat.curioswitch.org",
        changeOrigin: true,
      },
    },
  },
});
