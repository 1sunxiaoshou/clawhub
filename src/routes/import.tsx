import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { Check, Github } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { EmptyState } from "../components/EmptyState";
import { Container } from "../components/layout/Container";
import { SignInButton } from "../components/SignInButton";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useI18n } from "../lib/i18n";
import { useAuthStatus } from "../lib/useAuthStatus";
import { formatBytes } from "./upload/-utils";

export const Route = createFileRoute("/import")({
  component: GithubImport,
});

export function GithubImport() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuthStatus();
  const [url, setUrl] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const detectGithubSkill = useAction(api.skills.detectGithubSkill);
  const importSkill = useAction(api.skills.importFromGithub);
  const navigate = useNavigate();

  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0);
  const selectedPreview = preview?.skills?.[selectedSkillIndex];

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [version, setVersion] = useState("");
  const [tags, setTags] = useState("latest");
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (selectedPreview) {
      setSlug(selectedPreview.slug || "");
      setDisplayName(selectedPreview.displayName || "");
      setVersion(selectedPreview.version || "1.0.0");
      setSelectedFilePaths(new Set(selectedPreview.files.map((f: any) => f.path)));
    }
  }, [selectedPreview]);

  const handleDetect = async () => {
    if (!url) return;
    setIsDetecting(true);
    setError(null);
    setPreview(null);
    try {
      const result = await detectGithubSkill({ url });
      if (result.skills.length === 0) {
        setError(t("skillDetail.skillNotFound"));
      } else {
        setPreview(result);
        setSelectedSkillIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDetecting(false);
    }
  };

  const selectAll = () => {
    if (!selectedPreview) return;
    setSelectedFilePaths(new Set(selectedPreview.files.map((f: any) => f.path)));
  };

  const clearAll = () => {
    setSelectedFilePaths(new Set());
  };

  const handleFileToggle = (path: string) => {
    const next = new Set(selectedFilePaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedFilePaths(next);
  };

  const applyDefaultSelection = () => {
    if (!selectedPreview) return;
    setSelectedFilePaths(new Set(selectedPreview.files.map((f: any) => f.path)));
  };

  const handleImport = async () => {
    if (!selectedPreview || !preview) return;
    setIsBusy(true);
    try {
      await importSkill({
        repoUrl: preview.repoUrl,
        commitHash: preview.commitHash,
        skillPath: selectedPreview.path,
        slug,
        displayName,
        version,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        filePaths: Array.from(selectedFilePaths),
      });
      toast.success(t("import.imported"));
      void navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="py-20">
        <Container>
          <EmptyState
            title={t("import.signInPrompt")}
            description={t("import.signInDesc")}
            action={<SignInButton />}
          />
        </Container>
      </main>
    );
  }

  const selectedCount = selectedFilePaths.size;
  const selectedBytes = selectedPreview?.files
    .filter((f: any) => selectedFilePaths.has(f.path))
    .reduce((acc: number, f: any) => acc + f.size, 0) || 0;

  return (
    <main className="py-10">
      <Container>
        <header className="mb-10 text-center">
          <Badge variant="accent" className="mb-3">
            {t("import.githubBadge")}
          </Badge>
          <h1 className="mb-3 font-display text-4xl font-bold text-[color:var(--ink)]">
            {t("import.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[color:var(--ink-soft)]">
            {t("import.description")}
          </p>
          <div className="mt-4 rounded-[var(--radius-md)] border border-amber-200/50 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-950/30 dark:bg-amber-950/40 dark:text-amber-200">
            {t("import.skillOnlyNotice", {
              link: (
                <Link to="/publish-skill" className="font-bold underline">
                  {t("import.publishPlugin")}
                </Link>
              ),
            })}
          </div>
        </header>

        <section className="mx-auto max-w-3xl">
          <Card className="mb-8 p-6">
            <div className="flex flex-col gap-4">
              <label htmlFor="repo-url" className="text-sm font-semibold text-[color:var(--ink)]">
                {t("import.githubUrl")}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Github
                    className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="repo-url"
                    className="pl-10"
                    placeholder={t("import.repoPlaceholder")}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDetect()}
                  />
                </div>
                <Button onClick={handleDetect} disabled={isDetecting || !url}>
                  {isDetecting ? t("import.loading") : t("import.detect")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <div className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                  <Check className="h-3 w-3 text-green-500" />
                  {t("import.publicOnly")}
                </div>
                {preview && (
                  <div className="flex items-center gap-2 text-xs text-[color:var(--ink-soft)]">
                    <Check className="h-3 w-3 text-green-500" />
                    {t("import.commitPinned")}
                  </div>
                )}
              </div>
            </div>

            {error && <p className="mt-4 text-sm font-semibold text-red-500">{error}</p>}
          </Card>

          {preview && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-xl font-bold text-[color:var(--ink)]">
                  {t("import.foundSkills", { count: preview.skills.length })}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {preview.skills.map((s: any, i: number) => (
                    <button
                      key={s.path}
                      type="button"
                      onClick={() => setSelectedSkillIndex(i)}
                      className={`flex flex-col items-start gap-1 rounded-[var(--radius-md)] border p-4 text-left transition-all ${
                        selectedSkillIndex === i
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-muted)] ring-1 ring-[color:var(--accent)]"
                          : "border-[color:var(--line)] bg-[color:var(--surface)] hover:border-[color:var(--ink-soft)]"
                      }`}
                    >
                      <span className="font-bold text-[color:var(--ink)]">
                        {s.displayName || s.slug || s.path}
                      </span>
                      <span className="font-mono text-xs text-[color:var(--ink-soft)]">
                        {s.path === "." ? "root" : s.path}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedPreview && (
                <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
                  <div className="flex flex-col gap-8">
                    <Card className="p-6">
                      <h2 className="mb-6 font-display text-lg font-bold text-[color:var(--ink)]">
                        {t("import.readyToImport")}
                      </h2>
                      <div className="grid gap-6">
                        <div className="grid gap-2">
                          <label
                            htmlFor="import-slug"
                            className="text-sm font-semibold text-[color:var(--ink)]"
                          >
                            {t("import.slug")}
                          </label>
                          <Input
                            id="import-slug"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                          />
                          <p className="text-xs text-[color:var(--ink-soft)]">
                            {t("import.slugDesc")}
                          </p>
                        </div>
                        <div className="grid gap-2">
                          <label
                            htmlFor="import-name"
                            className="text-sm font-semibold text-[color:var(--ink)]"
                          >
                            {t("import.displayName")}
                          </label>
                          <Input
                            id="import-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                          />
                          <p className="text-xs text-[color:var(--ink-soft)]">
                            {t("import.displayNameDesc")}
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <label
                              htmlFor="import-version"
                              className="text-sm font-semibold text-[color:var(--ink)]"
                            >
                              {t("import.version")}
                            </label>
                            <Input
                              id="import-version"
                              value={version}
                              onChange={(e) => setVersion(e.target.value)}
                            />
                            <p className="text-xs text-[color:var(--ink-soft)]">
                              {t("import.versionDesc")}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <label
                              htmlFor="import-tags"
                              className="text-sm font-semibold text-[color:var(--ink)]"
                            >
                              {t("import.tags")}
                            </label>
                            <Input
                              id="import-tags"
                              value={tags}
                              onChange={(e) => setTags(e.target.value)}
                            />
                            <p className="text-xs text-[color:var(--ink-soft)]">
                              {t("import.tagsDesc")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-display text-lg font-bold text-[color:var(--ink)]">
                          {t("import.files")}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={applyDefaultSelection}
                          >
                            {t("import.selectReferenced")}
                          </Button>
                          <Button variant="outline" size="sm" disabled={isBusy} onClick={selectAll}>
                            {t("import.selectAll")}
                          </Button>
                          <Button variant="outline" size="sm" disabled={isBusy} onClick={clearAll}>
                            {t("import.clear")}
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                        {t("import.selectedStats", {
                          selected: selectedCount,
                          total: selectedPreview.files.length,
                          size: formatBytes(selectedBytes),
                        })}
                      </p>

                      <div className="mt-6 max-h-[400px] overflow-y-auto rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-muted)]">
                        {selectedPreview.files.map((file: any) => (
                          <div
                            key={file.path}
                            className="flex items-center gap-3 border-b border-[color:var(--line)] px-4 py-2 last:border-0"
                          >
                            <input
                              type="checkbox"
                              id={`file-${file.path}`}
                              checked={selectedFilePaths.has(file.path)}
                              onChange={() => handleFileToggle(file.path)}
                              className="h-4 w-4 rounded border-[color:var(--line)]"
                            />
                            <label
                              htmlFor={`file-${file.path}`}
                              className="flex flex-1 items-center justify-between font-mono text-xs"
                            >
                              <span className="truncate text-[color:var(--ink)]">{file.path}</span>
                              <span className="ml-2 shrink-0 text-[color:var(--ink-soft)]">
                                {formatBytes(file.size)}
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  <aside>
                    <div className="sticky top-24">
                      <Button
                        size="lg"
                        className="w-full shadow-lg"
                        disabled={isBusy || selectedCount === 0 || !slug || !version}
                        onClick={handleImport}
                      >
                        {isBusy ? t("import.loading") : t("import.importAndPublish")}
                      </Button>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          )}
        </section>
      </Container>
    </main>
  );
}
