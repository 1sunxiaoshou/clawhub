import { ConvexError } from "convex/values";
import { isMacJunkPath } from "./skills";

/* ─── Shared constants ────────────────────────────────────────────── */

export const MAX_REMOTE_ZIP_BYTES = 25 * 1024 * 1024;
export const MAX_SELECTED_BYTES = 50 * 1024 * 1024;
export const MAX_UNZIPPED_BYTES = 40 * 1024 * 1024;
export const MAX_FILE_COUNT = 7_500;
export const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024;

/* ─── ZIP download ────────────────────────────────────────────────── */

export async function fetchClawhubZipBytes(downloadZipUrl: string, fetcher: typeof fetch) {
  const response = await fetcher(downloadZipUrl, {
    headers: { "User-Agent": "clawhub/clawhub-import" },
  });
  if (!response.ok) throw new ConvexError("ClawHub archive download failed");
  return await readLimitedBytes(response, MAX_REMOTE_ZIP_BYTES);
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
