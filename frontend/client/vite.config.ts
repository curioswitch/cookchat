import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
    }),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
      router:
        command === "serve"
          ? {
              codeSplittingOptions: {
                defaultBehavior: [],
              },
            }
          : undefined,
      spa: {
        maskPath: "/_shell",
        prerender: {
          enabled: true,
        },
      },
    }),
    react({}),
    tailwindcss(),
  ],
  server: {
    port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8080,
    proxy: {
      "/frontendapi.FrontendService": {
        target:
          process.env.SERVICE_FRONTEND ??
          "https://alpha.cookchat.curioswitch.org",
        changeOrigin: true,
      },
    },
  },
}));
