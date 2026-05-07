import { ConvexError } from "convex/values";
import { CLAWHUB_CONVEX_QUERY_URL } from "./clawhubSyncConfig";
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

export type ClawhubImportMetadata = Omit<ClawhubImportResolved, "zipBytes">;

type ResolveClawhubImportMetadataOptions = {
  downloadBaseUrl?: string;
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

export function buildDirectClawhubDownloadZipUrl(slug: string) {
  return buildDirectClawhubDownloadZipUrlWithBase(slug);
}

export function buildDirectClawhubDownloadZipUrlWithBase(slug: string, downloadBaseUrl?: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) throw new ConvexError("Could not determine ClawHub slug from URL");
  const queryUrl = downloadBaseUrl
    ? new URL(downloadBaseUrl)
    : new URL(CLAWHUB_CONVEX_QUERY_URL);
  if (!downloadBaseUrl) {
    queryUrl.hostname = queryUrl.hostname.replace(/\.convex\.cloud$/i, ".convex.site");
  }
  queryUrl.pathname = "/api/v1/download";
  queryUrl.search = "";
  queryUrl.searchParams.set("slug", normalizedSlug);
  return queryUrl.toString();
}

export async function resolveClawhubDownloadBaseUrl(pageUrl: string, fetcher: typeof fetch) {
  const parsed = parseClawhubImportUrl(pageUrl);
  try {
    const response = await fetcher(parsed.originalUrl, {
      headers: { "User-Agent": "clawhub/clawhub-import" },
    });
    if (response.ok) {
      const html = await response.text();
      const hrefs = Array.from(
        html.matchAll(/<a\b[^>]*href=(["'])([^"']+)\1[^>]*>/gi),
        (match) => match[2]?.trim(),
      ).filter((href): href is string => Boolean(href));
      for (const href of hrefs) {
        const absoluteUrl = new URL(href, parsed.originalUrl);
        if (
          absoluteUrl.pathname.toLowerCase().endsWith("/api/v1/download") &&
          absoluteUrl.searchParams.has("slug")
        ) {
          absoluteUrl.pathname = "/";
          absoluteUrl.search = "";
          absoluteUrl.hash = "";
          return absoluteUrl.toString().replace(/\/$/, "");
        }
      }
    }
  } catch {
    // Fall back to the derived deployment URL below.
  }

  const queryUrl = new URL(CLAWHUB_CONVEX_QUERY_URL);
  queryUrl.hostname = queryUrl.hostname.replace(/\.convex\.cloud$/i, ".convex.site");
  queryUrl.pathname = "/";
  queryUrl.search = "";
  queryUrl.hash = "";
  return queryUrl.toString().replace(/\/$/, "");
}

export async function resolveClawhubImportPage(pageUrl: string, fetcher: typeof fetch) {
  const metadata = await resolveClawhubImportMetadata(pageUrl, fetcher);
  const zipBytes = await downloadClawhubImportZip(metadata, fetcher);

  return {
    ...metadata,
    zipBytes,
  } satisfies ClawhubImportResolved;
}

export async function resolveClawhubImportMetadata(
  pageUrl: string,
  fetcher: typeof fetch,
  options: ResolveClawhubImportMetadataOptions = {},
) {
  void fetcher;
  const parsed = parseClawhubImportUrl(pageUrl);
  const canonicalUrl = normalizeClawhubPageUrl(parsed.originalUrl);
  const slug = getSlugFromClawhubUrl(canonicalUrl);
  const downloadZipUrl = buildDirectClawhubDownloadZipUrlWithBase(slug, options.downloadBaseUrl);

  return {
    pageUrl: parsed.originalUrl,
    canonicalUrl,
    downloadZipUrl,
    slug,
  } satisfies ClawhubImportMetadata;
}

export async function downloadClawhubImportZip(
  metadata: ClawhubImportMetadata,
  fetcher: typeof fetch,
) {
  return await fetchClawhubZipBytes(metadata.downloadZipUrl, fetcher);
}

function normalizeClawhubPageUrl(pageUrl: string) {
  const url = new URL(pageUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getSlugFromClawhubUrl(pageUrl: string) {
  const url = new URL(pageUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const slug = segments.at(-1)?.trim().toLowerCase();
  if (!slug) throw new ConvexError("Could not determine ClawHub slug from URL");
  return slug;
}
