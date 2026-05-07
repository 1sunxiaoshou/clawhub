import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const copies = [
  {
    source: path.resolve("public/deepdata-logo.png"),
    targets: [
      path.resolve(".output/server/deepdata-logo.png"),
      path.resolve(".output/server/public/deepdata-logo.png"),
      path.resolve(".vercel/output/functions/__server.func/deepdata-logo.png"),
      path.resolve(".vercel/output/functions/__server.func/public/deepdata-logo.png"),
    ],
  },
  {
    source: path.resolve("node_modules/@resvg/resvg-wasm/index_bg.wasm"),
    targets: [
      path.resolve(".output/server/node_modules/@resvg/resvg-wasm/index_bg.wasm"),
      path.resolve(
        ".vercel/output/functions/__server.func/node_modules/@resvg/resvg-wasm/index_bg.wasm",
      ),
    ],
  },
  {
    source: path.resolve(
      "node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2",
    ),
    targets: [
      path.resolve(
        ".output/server/node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2",
      ),
      path.resolve(
        ".vercel/output/functions/__server.func/node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2",
      ),
    ],
  },
  {
    source: path.resolve(
      "node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-500-normal.woff2",
    ),
    targets: [
      path.resolve(
        ".output/server/node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-500-normal.woff2",
      ),
      path.resolve(
        ".vercel/output/functions/__server.func/node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-500-normal.woff2",
      ),
    ],
  },
  {
    source: path.resolve(
      "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
    ),
    targets: [
      path.resolve(
        ".output/server/node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
      ),
      path.resolve(
        ".vercel/output/functions/__server.func/node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
      ),
    ],
  },
];

for (const { source, targets } of copies) {
  for (const target of targets) {
    const parent = path.dirname(target);
    await mkdir(parent, { recursive: true });
    await copyFile(source, target);
  }
}
