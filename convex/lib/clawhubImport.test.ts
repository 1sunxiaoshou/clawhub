/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { buildGitHubZipForTests } from "./githubImport";
import {
  buildDirectClawhubDownloadZipUrl,
  extractClawhubDownloadZipUrl,
  parseClawhubImportUrl,
  resolveClawhubDownloadBaseUrl,
  resolveClawhubImportPage,
} from "./clawhubImport";

function requestInfoToUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  throw new Error("Unexpected fetch input type");
}

describe("clawhub import", () => {
  it("parses clawhub urls", () => {
    expect(parseClawhubImportUrl("https://clawhub.ai/kenoodl-synthesis/skill-hunter")).toEqual({
      originalUrl: "https://clawhub.ai/kenoodl-synthesis/skill-hunter",
    });
  });

  it("extracts the download zip url from page html", () => {
    const href = extractClawhubDownloadZipUrl(
      `<html><body><a href="/download/skill.zip">Download zip</a></body></html>`,
      "https://clawhub.ai/kenoodl-synthesis/skill-hunter",
    );
    expect(href).toBe("https://clawhub.ai/download/skill.zip");
  });

  it("ignores unrelated anchors before the download link", () => {
    const href = extractClawhubDownloadZipUrl(
      `<html><body><nav><a href="/">ClawHub</a></nav><main><a class="btn" href="https://wry-manatee-359.convex.site/api/v1/download?slug=self-improving-agent">Download zip</a></main></body></html>`,
      "https://clawhub.ai/pskoett/self-improving-agent",
    );
    expect(href).toBe(
      "https://wry-manatee-359.convex.site/api/v1/download?slug=self-improving-agent",
    );
  });

  it("builds direct download urls against the Convex deployment", () => {
    expect(buildDirectClawhubDownloadZipUrl("prismfy-search")).toBe(
      "https://wry-manatee-359.convex.site/api/v1/download?slug=prismfy-search",
    );
  });

  it("resolves the actual download base url from a skill page once", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = requestInfoToUrlString(input);
      if (url === "https://clawhub.ai/u/demo") {
        return new Response(
          `<html><body><a href="https://wry-manatee-359.convex.site/api/v1/download?slug=demo">Download zip</a></body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    await expect(resolveClawhubDownloadBaseUrl("https://clawhub.ai/u/demo", fetcher)).resolves.toBe(
      "https://wry-manatee-359.convex.site",
    );
  });

  it("resolves a page and downloads zip directly without fetching html", async () => {
    const zip = buildGitHubZipForTests({
      "skill/SKILL.md": `---\nname: demo\n---\nBody`,
    });

    const fetcher: typeof fetch = async (input) => {
      const url = requestInfoToUrlString(input);
      if (url === "https://wry-manatee-359.convex.site/api/v1/download?slug=demo") {
        return new Response(zip, {
          status: 200,
          headers: { "content-type": "application/zip" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const resolved = await resolveClawhubImportPage("https://clawhub.ai/skills/demo", fetcher);
    expect(resolved.pageUrl).toBe("https://clawhub.ai/skills/demo");
    expect(resolved.canonicalUrl).toBe("https://clawhub.ai/skills/demo");
    expect(resolved.downloadZipUrl).toBe(
      "https://wry-manatee-359.convex.site/api/v1/download?slug=demo",
    );
    expect(resolved.slug).toBe("demo");
    expect(resolved.zipBytes).toBeInstanceOf(Uint8Array);
    expect(resolved.zipBytes.byteLength).toBeGreaterThan(0);
  });
});
