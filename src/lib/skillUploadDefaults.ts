import semver from 'semver';
import { parse as parseYaml } from 'yaml';

import { readText } from '../routes/upload/-utils';

type ParsedFrontmatter = Record<string, unknown>;

export type SkillUploadDefaults = {
  slug?: string;
  displayName?: string;
  version?: string;
};

export async function deriveSkillUploadDefaults(files: File[]): Promise<SkillUploadDefaults> {
  if (files.length === 0) return {};

  const stripRoot = getStripRoot(files);
  const normalizedFiles = files.map((file) => ({
    file,
    path: normalizeUploadPath(file, stripRoot),
  }));

  const readmeEntry = normalizedFiles.find((entry) => {
    const lower = entry.path.toLowerCase();
    return lower === 'skill.md' || lower === 'skills.md';
  });
  if (!readmeEntry) return {};

  const text = await readText(readmeEntry.file);
  const frontmatter = parseFrontmatter(text);
  const rawDisplayName = getStringValue(frontmatter, 'name');
  const rawSlug = getStringValue(frontmatter, 'slug');
  const rawVersion = getStringValue(frontmatter, 'version');

  const inferredSlugBase =
    sanitizeSlug(rawSlug) ||
    sanitizeSlug(stripRoot ?? '') ||
    sanitizeSlug(rawDisplayName ?? '') ||
    sanitizeSlug(getFileStem(readmeEntry.path));

  return {
    slug: inferredSlugBase || undefined,
    displayName: rawDisplayName?.trim() || undefined,
    version: rawVersion && semver.valid(rawVersion.trim()) ? rawVersion.trim() : undefined,
  };
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.startsWith('---')) return {};
  const endIndex = normalized.indexOf('\n---', 3);
  if (endIndex === -1) return {};

  try {
    const parsed = parseYaml(normalized.slice(4, endIndex)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as ParsedFrontmatter;
  } catch {
    return {};
  }
}

function getStringValue(frontmatter: ParsedFrontmatter, key: string) {
  const value = frontmatter[key];
  return typeof value === 'string' ? value : undefined;
}

function getStripRoot(files: File[]) {
  const paths = files.map((file) => getRawFilePath(file));
  if (paths.length === 0) return null;
  if (!paths.every((path) => path.includes('/'))) return null;

  const firstSegment = paths[0]?.split('/')[0];
  if (!firstSegment) return null;
  return paths.every((path) => path.startsWith(`${firstSegment}/`)) ? firstSegment : null;
}

function normalizeUploadPath(file: File, stripRoot: string | null) {
  const raw = getRawFilePath(file);
  if (stripRoot && raw.startsWith(`${stripRoot}/`)) {
    return raw.slice(stripRoot.length + 1);
  }
  return raw;
}

function getRawFilePath(file: File) {
  return (file.webkitRelativePath || file.name).replace(/^\.\//, '').trim();
}

function getFileStem(path: string) {
  const base = path.split('/').at(-1) ?? path;
  return base.replace(/\.[^.]+$/, '');
}

function sanitizeSlug(value?: string | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/--+/g, '-');
}
