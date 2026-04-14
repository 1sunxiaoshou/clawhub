import { inflateSync } from "fflate";
import { ConvexError } from "convex/values";
import { isMacJunkPath } from "./skills";

/* ─── Shared constants ────────────────────────────────────────────── */

export const MAX_REMOTE_ZIP_BYTES = 25 * 1024 * 1024;
export const MAX_SELECTED_BYTES = 50 * 1024 * 1024;
export const MAX_UNZIPPED_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_COUNT = 100;
export const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ARCHIVE_MEMORY_BUDGET_BYTES = 48 * 1024 * 1024;
const MAX_DOWNLOAD_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1_500;
const DOWNLOAD_TTFB_TIMEOUT_MS = 180_000;

/* ─── ZIP download ────────────────────────────────────────────────── */

export async function fetchClawhubZipBytes(downloadZipUrl: string, fetcher: typeof fetch) {
  let lastStatus = 0;
  let lastBody = "";
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_DOWNLOAD_RETRIES; attempt += 1) {
    let retryResponse: Response | null = null;
    try {
      const response = await fetchWithTimeout(fetcher, downloadZipUrl, {
        headers: { "User-Agent": "clawhub/clawhub-import" },
      });
      retryResponse = response;

      if (response.ok) {
        return await readLimitedBytes(response, MAX_REMOTE_ZIP_BYTES);
      }

      lastStatus = response.status;
      lastBody = await response.text().catch(() => "");

      if (!shouldRetryDownload(response.status) || attempt === MAX_DOWNLOAD_RETRIES) {
        break;
      }
    } catch (error) {
      lastError = error;
      if (!shouldRetryDownloadError(error) || attempt === MAX_DOWNLOAD_RETRIES) {
        break;
      }
    }

    await delay(getRetryDelayMs(retryResponse, attempt));
  }

  if (lastStatus === 429) {
    throw new ConvexError(
      `ClawHub archive download rate limited (429): ${lastBody || "Rate limit exceeded"}`,
    );
  }
  if (lastError) {
    throw new ConvexError(`ClawHub archive download failed: ${toDownloadErrorMessage(lastError)}`);
  }
  throw new ConvexError(`ClawHub archive download failed: ${lastStatus || "unknown"}`);
}

async function fetchWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TTFB_TIMEOUT_MS);
  try {
    return await fetcher(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readLimitedBytes(response: Response, maxBytes: number) {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const contentLength = Number.parseInt(lengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new ConvexError("ClawHub archive is too large");
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new ConvexError("ClawHub archive is too large");
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) throw new ConvexError("ClawHub archive is too large");
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/* ─── ZIP path utilities ──────────────────────────────────────────── */


export function unzipToEntries(
  zipBytes: Uint8Array,
  unzipSync: (data: Uint8Array) => Record<string, Uint8Array>,
) {
  assertZipInflationBudget(zipBytes);
  const entries = unzipSync(zipBytes);
  const out: Record<string, Uint8Array> = {};
  const rawPaths = Object.keys(entries);
  if (rawPaths.length > MAX_FILE_COUNT) throw new ConvexError("Repo archive has too many files");
  let totalBytes = 0;
  for (const [rawPath, bytes] of Object.entries(entries)) {
    const normalizedPath = normalizeZipPath(rawPath);
    if (!normalizedPath) continue;
    if (isMacJunkPath(normalizedPath)) continue;
    if (!bytes) continue;
    if (bytes.byteLength > MAX_SINGLE_FILE_BYTES) continue;
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_UNZIPPED_BYTES) throw new ConvexError("Repo archive is too large");
    out[normalizedPath] = bytes;
  }
  return out;
}

export function selectiveUnzip(
  zipBytes: Uint8Array,
  matchFn: (path: string) => boolean,
) {
  const eocdOffset = findEocdOffset(zipBytes);
  if (eocdOffset < 0) return {};

  const totalEntries = readUint16(zipBytes, eocdOffset + 10);
  const centralDirectoryOffset = readUint32(zipBytes, eocdOffset + 16);

  const out: Record<string, Uint8Array> = {};
  let offset = centralDirectoryOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (readUint32(zipBytes, offset) !== 0x02014b50) break;

    const compressionMethod = readUint16(zipBytes, offset + 10);
    const compressedSize = readUint32(zipBytes, offset + 20);
    const fileNameLength = readUint16(zipBytes, offset + 28);
    const extraFieldLength = readUint16(zipBytes, offset + 30);
    const fileCommentLength = readUint16(zipBytes, offset + 32);
    const localHeaderOffset = readUint32(zipBytes, offset + 42);

    const fileNameBytes = zipBytes.slice(offset + 46, offset + 46 + fileNameLength);
    const fileName = new TextDecoder().decode(fileNameBytes);
    const normalizedPath = normalizeZipPath(fileName);

    if (normalizedPath && matchFn(normalizedPath)) {
      const lfhOffset = localHeaderOffset;
      const lfhFileNameLen = readUint16(zipBytes, lfhOffset + 26);
      const lfhExtraLen = readUint16(zipBytes, lfhOffset + 28);
      const dataStart = lfhOffset + 30 + lfhFileNameLen + lfhExtraLen;
      const compressedData = zipBytes.slice(dataStart, dataStart + compressedSize);

      if (compressionMethod === 8) {
        // DEFLATE
        out[normalizedPath] = inflateSync(compressedData);
      } else if (compressionMethod === 0) {
        // STORE
        out[normalizedPath] = compressedData;
      }
    }

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }
  return out;
}

function assertZipInflationBudget(zipBytes: Uint8Array) {
  const estimate = estimateZipInflation(zipBytes);
  if (!estimate) return;
  if (estimate.fileCount > MAX_FILE_COUNT) {
    throw new ConvexError("Repo archive has too many files");
  }
  if (estimate.totalUncompressedBytes > MAX_UNZIPPED_BYTES) {
    throw new ConvexError("Repo archive is too large");
  }
  if (estimate.totalUncompressedBytes + zipBytes.byteLength > MAX_ARCHIVE_MEMORY_BUDGET_BYTES) {
    throw new ConvexError("Repo archive exceeds action memory budget");
  }
}

function estimateZipInflation(zipBytes: Uint8Array) {
  const eocdOffset = findEocdOffset(zipBytes);
  if (eocdOffset < 0) return null;

  const totalEntries = readUint16(zipBytes, eocdOffset + 10);
  const centralDirectorySize = readUint32(zipBytes, eocdOffset + 12);
  const centralDirectoryOffset = readUint32(zipBytes, eocdOffset + 16);

  if (
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    return null;
  }

  let offset = centralDirectoryOffset;
  let fileCount = 0;
  let totalUncompressedBytes = 0;

  while (offset + 46 <= zipBytes.byteLength && fileCount < totalEntries) {
    if (readUint32(zipBytes, offset) !== 0x02014b50) {
      return null;
    }
    const compressedSize = readUint32(zipBytes, offset + 20);
    const uncompressedSize = readUint32(zipBytes, offset + 24);
    const fileNameLength = readUint16(zipBytes, offset + 28);
    const extraFieldLength = readUint16(zipBytes, offset + 30);
    const fileCommentLength = readUint16(zipBytes, offset + 32);

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff
    ) {
      return null;
    }

    totalUncompressedBytes += uncompressedSize;
    fileCount += 1;
    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;

    if (fileCount > MAX_FILE_COUNT || totalUncompressedBytes > MAX_UNZIPPED_BYTES) {
      return { fileCount, totalUncompressedBytes };
    }
  }

  return fileCount === totalEntries ? { fileCount, totalUncompressedBytes } : null;
}

export function inspectZipArchive(zipBytes: Uint8Array) {
  const estimate = estimateZipInflation(zipBytes);
  return {
    zipBytes: zipBytes.byteLength,
    estimate,
    exceedsLimits: estimate
      ? estimate.fileCount > MAX_FILE_COUNT ||
        estimate.totalUncompressedBytes > MAX_UNZIPPED_BYTES ||
        estimate.totalUncompressedBytes + zipBytes.byteLength > MAX_ARCHIVE_MEMORY_BUDGET_BYTES
      : false,
  };
}

function findEocdOffset(zipBytes: Uint8Array) {
  const minEocdSize = 22;
  const maxCommentLength = 0xffff;
  const start = Math.max(0, zipBytes.byteLength - minEocdSize - maxCommentLength);
  for (let offset = zipBytes.byteLength - minEocdSize; offset >= start; offset -= 1) {
    if (readUint32(zipBytes, offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function readUint16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function shouldRetryDownload(status: number) {
  return status === 429 || status === 503;
}

function shouldRetryDownloadError(error: unknown) {
  const message = toDownloadErrorMessage(error).toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("connection reset") ||
    message.includes("socket hang up") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("und_err")
  );
}

function getRetryDelayMs(response: Response | null, attempt: number) {
  if (response) {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number.parseFloat(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.ceil(seconds * 1_000);
      }
    }
  }
  return BASE_RETRY_DELAY_MS * (attempt + 1);
}

function toDownloadErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return `timed out after ${Math.floor(DOWNLOAD_TTFB_TIMEOUT_MS / 1000)}s waiting for download`;
    }
    return error.message;
  }
  return String(error);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeZipPath(path: string) {
  const normalized = path
    .replaceAll("\u0000", "")
    .replaceAll("\\", "/")
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  if (!normalized) return "";
  if (normalized.includes("..")) return "";
  return normalized;
}

/* ─── Hashing ─────────────────────────────────────────────────────── */

export async function sha256Hex(bytes: Uint8Array) {
  const data = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* ─── Source metadata ─────────────────────────────────────────────── */

export function buildClawhubSourceRepo(resolved: { canonicalUrl: string }) {
  const url = new URL(resolved.canonicalUrl);
  return `${url.hostname}${url.pathname}`;
}

/* ─── Error formatting ────────────────────────────────────────────── */

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
