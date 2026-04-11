import { parse } from "@create-markdown/core";
import { blocksToHTML, renderAsync, shikiPlugin } from "@create-markdown/preview";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

interface MarkdownPreviewProps {
  children: string;
  className?: string;
  /** Enable Shiki syntax highlighting for code blocks (async). Default: true */
  highlight?: boolean;
}

/**
 * Auto-link bare URLs in HTML that aren't already inside anchor tags or attributes.
 * Matches http/https URLs in text nodes only (not inside tags).
 */
function autolinkURLs(html: string): string {
  // Split HTML into tags and text segments, then only linkify text segments
  return html.replace(
    /(<[^>]*>)|((https?:\/\/)[^\s<>"')\]]+)/gi,
    (match, tag: string | undefined, url: string | undefined) => {
      // If it's an HTML tag, leave it alone
      if (tag) return tag;
      // If it's a bare URL in text content, wrap it
      if (url) {
        // Trim trailing punctuation that's likely not part of the URL
        const trailingPunct = /[.,;:!?)]+$/.exec(url);
        const cleanUrl = trailingPunct ? url.slice(0, -trailingPunct[0].length) : url;
        const suffix = trailingPunct ? trailingPunct[0] : "";
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${suffix}`;
      }
      return match;
    },
  );
}

/**
 * Rich markdown preview using @create-markdown/preview.
 * Renders markdown → HTML with optional Shiki syntax highlighting.
 * Falls back to synchronous (unhighlighted) rendering while Shiki loads.
 */
export function MarkdownPreview({ children, className, highlight = true }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });
  // Initial sync render (no highlighting) for instant display
  const [html, setHtml] = useState(() => {
    try {
      const blocks = parse(children);
      return autolinkURLs(blocksToHTML(blocks));
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const syncTheme = () => {
      setResolvedTheme(root.dataset.theme === "dark" ? "dark" : "light");
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Re-parse synchronously on content change
    try {
      const blocks = parse(children);
      const syncHtml = autolinkURLs(blocksToHTML(blocks));
      setHtml(syncHtml);

      if (!highlight) return;

      // Async render with Shiki syntax highlighting
      void renderAsync(blocks, {
        plugins: [shikiPlugin({ theme: resolvedTheme === "dark" ? "github-dark" : "github-light" })],
      })
        .then((highlighted) => {
          if (!cancelled) {
            setHtml(autolinkURLs(highlighted));
          }
        })
        .catch(() => {
          // Shiki failed to load — keep the sync render
        });
    } catch {
      // Parse failed — clear
      setHtml("");
    }

    return () => {
      cancelled = true;
    };
  }, [children, highlight, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className={cn("markdown", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
