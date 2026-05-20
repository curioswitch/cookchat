import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { imagetools } from "vite-imagetools";

const config = defineConfig(({ command }) => ({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      strategy: ["url", "baseLocale"],
      urlPatterns: [
        {
          pattern: "/:path(.*)?",
          localized: [
            ["en", "/en/:path(.*)?"],
            ["ja", "/:path(.*)?"],
          ],
        },
      ],
    }),
    imagetools(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
      router:
        command === "serve"
          ? {
              // Avoid suspending the active route during HMR in dev.
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
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
}));

export default config;
