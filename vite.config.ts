// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageInfo = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version?: string };
const buildId =
  process.env["CF_PAGES_COMMIT_SHA"] ??
  process.env["COMMIT_SHA"] ??
  process.env["GITHUB_SHA"] ??
  "no disponible";

export default defineConfig({
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(packageInfo.version ?? "sin versión publicada"),
      __APP_BUILD__: JSON.stringify(buildId),
    },
    environments: {
      ssr: {
        resolve: {
          alias: [
            {
              // pdfjs-dist solo se usa en el navegador (import dinámico en useEffect);
              // en el bundle SSR se sustituye por un stub para que Rolldown no lo empaquete.
              find: /^pdfjs-dist(\/.*)?$/,
              replacement: fileURLToPath(new URL("./src/lib/pdfjs-stub.ts", import.meta.url)),
            },
          ],
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
