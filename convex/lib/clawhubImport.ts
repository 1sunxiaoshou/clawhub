import { ConvexError } from "convex/values";
import { fetchClawhubZipBytes } from "./zipUtils";

export type ClawhubImportUrl = {
  originalUrl: string;
};

export type ClawhubImportResolved = {
  pageUrl: string;
  canonicalUrl: string;
  downloadZipUrl: string;
  slug: string;
  zipBytes: Uint8Array;
};

export function parseClawhubImportUrl(input: string): ClawhubImportUrl {
  const originalUrl = input.trim();
  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    throw new ConvexError("Invalid ClawHub URL");
  }
  if (url.protocol !== "https:") throw new ConvexError("Only https:// URLs are supported");
  if (!url.hostname.endsWith("clawhub.ai")) throw new ConvexError("Only clawhub.ai URLs are supported");
  if (!url.pathname || url.pathname === "/") throw new ConvexError("ClawHub skill URL is required");
  return { originalUrl };
}

export function extractClawhubDownloadZipUrl(html: string, pageUrl: string) {
  const hrefs = Array.from(html.matchAll(/<a\b[^>]*href=(["'])([^"']+)\1[^>]*>/gi), (match) =>
    match[2]?.trim(),
  ).filter((href): href is string => Boolean(href));

  for (const href of hrefs) {
    const absoluteUrl = new URL(href, pageUrl);
    const path = absoluteUrl.pathname.toLowerCase();
    if (path.includes("/download/") || path.endsWith(".zip")) {
      return absoluteUrl.toString();
    }
    if (path.endsWith("/api/v1/download") && absoluteUrl.searchParams.has("slug")) {
      return absoluteUrl.toString();
    }
  }

  throw new ConvexError("Could not find a download zip link on the ClawHub page");
}

export async function resolveClawhubImportPage(pageUrl: string, fetcher: typeof fetch) {
  const parsed = parseClawhubImportUrl(pageUrl);
  const response = await fetcher(parsed.originalUrl, {
    headers: { "User-Agent": "clawhub/clawhub-import" },
  });
  if (!response.ok) throw new ConvexError("ClawHub page fetch failed");

  const html = await response.text();
  const canonicalUrl = extractCanonicalUrl(html, parsed.originalUrl) ?? parsed.originalUrl;
  const downloadZipUrl = extractClawhubDownloadZipUrl(html, canonicalUrl);
  const zipBytes = await fetchClawhubZipBytes(downloadZipUrl, fetcher);
  const slug = getSlugFromClawhubUrl(canonicalUrl);

  return {
    pageUrl: parsed.originalUrl,
    canonicalUrl,
    downloadZipUrl,
    slug,
    zipBytes,
  } satisfies ClawhubImportResolved;
}

function extractCanonicalUrl(html: string, pageUrl: string) {
  const canonical = html.match(
    /<link\b[^>]*rel=(["'])canonical\1[^>]*href=(["'])([^"']+)\2[^>]*>/i,
  );
  const href = canonical?.[3]?.trim();
  if (!href) return null;
  return new URL(href, pageUrl).toString();
}

function getSlugFromClawhubUrl(pageUrl: string) {
  const url = new URL(pageUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const slug = segments.at(-1)?.trim().toLowerCase();
  if (!slug) throw new ConvexError("Could not determine ClawHub slug from URL");
  return slug;
}
