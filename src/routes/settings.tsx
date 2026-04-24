import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  Github,
  KeyRound,
  Link2,
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SignInButton } from "../components/SignInButton";
import { Container } from "../components/layout/Container";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import { getUserFacingAuthError } from "../lib/authErrorMessage";
import { gravatarUrl } from "../lib/gravatar";
import { useI18n } from "../lib/i18n";

type ProviderName = "password" | "github" | "wecom";

type LoginMethodsResult = {
  primaryLoginMethod: ProviderName | null;
  lastLoginAt: number | null;
  lastLoginMethod: ProviderName | null;
  methods: Array<{
    provider: ProviderName;
    linked: boolean;
    canUnlink: boolean;
    accountName: string | null;
  }>;
};

function SettingsSection(props: {
  kicker: string;
  title: string;
  description: string;
  meta?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t border-[color:var(--line)] pt-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div className="space-y-2">
        <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
          {props.kicker}
        </p>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[1.45rem] font-bold tracking-[-0.03em] text-[color:var(--ink)]">
              {props.title}
            </h2>
            {props.meta ? (
              <span className="text-sm font-medium text-[color:var(--ink-soft)]">{props.meta}</span>
            ) : null}
          </div>
          <p className="max-w-[28rem] text-sm leading-6 text-[color:var(--ink-soft)]">
            {props.description}
          </p>
        </div>
      </div>
      <div className="grid gap-3">
        {props.action ? <div className="flex justify-end">{props.action}</div> : null}
        {props.children}
      </div>
    </section>
  );
}

function SettingsLoading() {
  return (
    <Container size="wide" className="py-8 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-8">
        <div className="space-y-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <Card className="border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-none">
          <CardContent className="grid gap-5 p-0">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

function providerLabel(provider: ProviderName, t: ReturnType<typeof useI18n>["t"]) {
  if (provider === "github") return "GitHub";
  if (provider === "wecom") return "WeCom";
  return t("settings.password");
}

function providerIcon(provider: ProviderName) {
  if (provider === "github") return <Github className="h-4 w-4" />;
  if (provider === "wecom") return <Link2 className="h-4 w-4" />;
  return <KeyRound className="h-4 w-4" />;
}

function formatLoginAccountName(method: { provider: ProviderName; accountName: string | null }) {
  if (!method.accountName) return null;
  if (method.provider === "github" && !method.accountName.startsWith("@")) {
    return `@${method.accountName}`;
  }
  return method.accountName;
}

export const Route = createFileRoute("/settings")({
  component: Settings,
});

export function Settings() {
  const { signIn } = useAuthActions();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const me = useQuery(api.users.me);
  const loginMethods = useQuery(api.users.getLoginMethods, me ? {} : "skip") as
    | LoginMethodsResult
    | undefined;
  const updateProfile = useMutation(api.users.updateProfile);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const unlinkLoginMethod = useMutation(api.users.unlinkLoginMethod);
  const tokens = useQuery(api.tokens.listMine, me ? {} : "skip") as
    | Array<{
        _id: Id<"apiTokens">;
        label: string;
        prefix: string;
        createdAt: number;
        lastUsedAt?: number;
        revokedAt?: number;
      }>
    | undefined;
  const createToken = useMutation(api.tokens.create);
  const revokeToken = useMutation(api.tokens.revoke);
  const renameToken = useMutation(api.tokens.rename);
  const publisherMemberships = useQuery(api.publishers.listMine) as
    | Array<{
        publisher: {
          _id: Id<"publishers">;
          handle: string;
          displayName: string;
          kind: "user" | "org";
          image?: string | null;
        };
        role: "owner" | "admin" | "publisher";
      }>
    | undefined;
  const createOrg = useMutation(api.publishers.createOrg);
  const deleteOrg = useMutation(api.publishers.deleteOrg);
  const addOrgMember = useMutation(api.publishers.addMember);
  const removeOrgMember = useMutation(api.publishers.removeMember);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [tokenLabel, setTokenLabel] = useState("CLI token");
  const [createdTokenValue, setCreatedTokenValue] = useState("");
  const [orgHandle, setOrgHandle] = useState("");
  const [orgDisplayName, setOrgDisplayName] = useState("");
  const [selectedOrgHandle, setSelectedOrgHandle] = useState("");
  const [memberHandle, setMemberHandle] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "admin" | "publisher">("publisher");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [deleteOrgDialogOpen, setDeleteOrgDialogOpen] = useState(false);
  const [createTokenDialogOpen, setCreateTokenDialogOpen] = useState(false);
  const [renameTokenDialogOpen, setRenameTokenDialogOpen] = useState(false);
  const [renamingToken, setRenamingToken] = useState<{ tokenId: Id<"apiTokens">; label: string } | null>(null);
  const [profileSaveState, setProfileSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [setupPassword, setSetupPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const bioTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastCommittedProfileRef = useRef({ displayName: "", bio: "" });
  const profileAutosaveReadyRef = useRef(false);

  const orgs = (publisherMemberships ?? []).filter((entry) => entry.publisher.kind === "org");
  const selectedOrg =
    orgs.find((entry) => entry.publisher.handle === selectedOrgHandle) ?? orgs[0] ?? null;
  const orgMembers = useQuery(
    api.publishers.listMembers,
    selectedOrg ? { publisherHandle: selectedOrg.publisher.handle } : "skip",
  ) as
    | {
        publisher: { _id: Id<"publishers">; handle: string } | null;
        members: Array<{
          role: "owner" | "admin" | "publisher";
          user: {
            _id: Id<"users">;
            handle: string | null;
            displayName: string | null;
            image: string | null;
          };
        }>;
      }
    | null
    | undefined;

  useEffect(() => {
    if (!me) return;
    const committed = {
      displayName: me.displayName ?? "",
      bio: me.bio ?? "",
    };
    setDisplayName(committed.displayName);
    setBio(committed.bio);
    lastCommittedProfileRef.current = committed;
    profileAutosaveReadyRef.current = true;
  }, [me]);

  useEffect(() => {
    if (selectedOrgHandle) return;
    if (orgs[0]?.publisher.handle) {
      setSelectedOrgHandle(orgs[0].publisher.handle);
    }
  }, [orgs, selectedOrgHandle]);

  const activeTokens = useMemo(
    () => (tokens ?? []).filter((token) => !token.revokedAt),
    [tokens],
  );

  useEffect(() => {
    if (!bioTextareaRef.current) return;
    const element = bioTextareaRef.current;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [bio]);

  function getNormalizedProfileDraft() {
    return {
      displayName: displayName.trim(),
      bio: bio.trim(),
    };
  }

  function hasProfileChanges() {
    const draft = getNormalizedProfileDraft();
    return (
      draft.displayName !== lastCommittedProfileRef.current.displayName.trim() ||
      draft.bio !== lastCommittedProfileRef.current.bio.trim()
    );
  }

  async function commitProfileChanges() {
    if (!hasProfileChanges()) {
      setProfileDialogOpen(false);
      return;
    }

    const draft = getNormalizedProfileDraft();
    setProfileSaveState("saving");
    await updateProfile({
      displayName: draft.displayName,
      bio: draft.bio || undefined,
    });
    lastCommittedProfileRef.current = {
      displayName: draft.displayName,
      bio: draft.bio,
    };
    setProfileSaveState("saved");
    setProfileDialogOpen(false);
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    await commitProfileChanges();
  }

  function onProfileEditorKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void commitProfileChanges();
    }
  }

  useEffect(() => {
    if (!profileAutosaveReadyRef.current) return;
    if (!hasProfileChanges()) {
      setProfileSaveState("idle");
      return;
    }

    setProfileSaveState("idle");
    const timeout = window.setTimeout(() => {
      void commitProfileChanges();
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [displayName, bio]);

  if (pathname !== "/settings") {
    return <Outlet />;
  }

  if (me === undefined) {
    return <SettingsLoading />;
  }

  if (me === null) {
    return (
      <Container size="narrow" className="py-10">
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <span>{t("settings.signInPrompt")}</span>
            <SignInButton variant="outline">{t("header.signIn")}</SignInButton>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const avatar = me.image ?? (me.email ? gravatarUrl(me.email, 160) : undefined);
  const identityName =
    displayName.trim() || me.name || me.handle || t("settings.userFallback");
  const handle = me.handle ?? (me.email ? me.email.split("@")[0] : undefined);
  const roleLabel =
    me.role === "admin"
      ? t("settings.roleAdmin")
      : me.role === "moderator"
        ? t("settings.roleModerator")
        : t("settings.roleUser");

  async function onDelete() {
    setDeleteDialogOpen(false);
    await deleteAccount();
  }

  async function onCreateToken() {
    const label = tokenLabel.trim() || t("cliAuth.tokenLabel");
    const result = await createToken({ label });
    setCreatedTokenValue(result.token);
  }

  function onCreateTokenDialogOpenChange(open: boolean) {
    setCreateTokenDialogOpen(open);
    if (!open) {
      setCreatedTokenValue("");
      setTokenLabel("");
    }
  }

  async function copyText(value: string, successMessage: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    toast.success(successMessage);
  }

  function getTokenDisplayValue(token: { prefix: string }) {
    return `${token.prefix}••••••`;
  }

  function openRenameTokenDialog(token: { _id: Id<"apiTokens">; label: string }) {
    setRenamingToken({ tokenId: token._id, label: token.label });
    setRenameTokenDialogOpen(true);
  }

  async function onRenameToken() {
    if (!renamingToken) return;
    await renameToken({ tokenId: renamingToken.tokenId, label: renamingToken.label });
    setRenameTokenDialogOpen(false);
    setRenamingToken(null);
  }

  function confirmRevokeToken(token: { _id: Id<"apiTokens">; label: string; revokedAt?: number }) {
    if (token.revokedAt) return;
    toast(t("settings.confirmRevokeToken", { label: token.label }), {
      action: {
        label: t("common.delete"),
        onClick: () => {
          void revokeToken({ tokenId: token._id });
        },
      },
    });
  }

  async function onUnlinkLoginMethod(provider: Exclude<ProviderName, "password">) {
    try {
      await unlinkLoginMethod({ provider });
      toast.success(t("auth.unlinked"));
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t("auth.unlinkFailed")));
    }
  }

  async function onEnablePassword(event: React.FormEvent) {
    event.preventDefault();
    const password = setupPassword.trim();
    const email = me?.email;
    if (!email) {
      toast.error(t("auth.emailRequired"));
      return;
    }
    if (!password) {
      toast.error(t("auth.newPasswordRequired"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("auth.passwordTooShort"));
      return;
    }
    try {
      await signIn("password", {
        flow: "signUp",
        email,
        password,
        redirectTo: "/settings",
      });
      toast.success(t("auth.passwordLinked"));
      setSetupPassword("");
      setIsSettingPassword(false);
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t("auth.signUpFailed")));
    }
  }

  async function onCreateOrg() {
    const result = await createOrg({
      handle: orgHandle.trim(),
      displayName: orgDisplayName.trim() || orgHandle.trim(),
      bio: undefined,
    });
    if (result?.publisher?.handle) {
      setSelectedOrgHandle(result.publisher.handle);
      setOrgHandle("");
      setOrgDisplayName("");
      setCreateOrgDialogOpen(false);
    }
  }

  async function onDeleteOrg() {
    if (!selectedOrg) return;
    try {
      await deleteOrg({ publisherId: selectedOrg.publisher._id });
      setDeleteOrgDialogOpen(false);
      setSelectedOrgHandle("");
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t("settings.deleteOrgFailed")));
    }
  }

  return (
    <Container className="py-8 sm:py-10">
      <main className="mx-auto flex max-w-[1100px] flex-col gap-8">
        <section className="grid gap-2 border-b border-[color:var(--line)] pb-6">
          <h1 className="font-display text-[2rem] font-bold tracking-[-0.04em] text-[color:var(--ink)]">
            {t("settings.title")}
          </h1>
          <p className="max-w-[42rem] text-sm leading-6 text-[color:var(--ink-soft)]">
            {t("settings.overviewDescription")}
          </p>
        </section>

        <SettingsSection
          kicker="Account"
          title={t("settings.profile")}
          description={t("settings.bioPlaceholder")}
        >
          <Card className="border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-none">
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="h-14 w-14 rounded-none border border-[color:var(--line)] bg-[color:var(--surface-muted)]">
                    {avatar ? <AvatarImage src={avatar} alt={identityName} /> : null}
                    <AvatarFallback className="rounded-none text-lg font-semibold">
                      {identityName[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-[color:var(--ink)]">
                        {identityName}
                      </div>
                      <Badge variant="accent" className="rounded-none border border-[color:var(--border-ui)] bg-transparent">
                        {roleLabel}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-sm text-[color:var(--ink-soft)]">
                      {handle ? `@${handle}` : me.email}
                    </div>
                    {bio ? (
                      <div className="mt-1 line-clamp-1 text-sm text-[color:var(--ink-soft)]">{bio}</div>
                    ) : null}
                  </div>
                </div>
                <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-[var(--radius-sm)]">
                      {t("settings.editProfile")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("settings.editProfile")}</DialogTitle>
                      <DialogDescription>{t("settings.overviewDescription")}</DialogDescription>
                    </DialogHeader>
                    <form className="grid gap-4" onSubmit={onSave}>
                      <div className="grid gap-2">
                        <Label htmlFor="settings-display-name">{t("settings.displayName")}</Label>
                        <Input
                          id="settings-display-name"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          onKeyDown={onProfileEditorKeyDown}
                          placeholder={t("settings.userFallback")}
                        />
                      </div>
                      {me.email ? (
                        <div className="grid gap-1">
                          <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
                            {t("settings.email")}
                          </div>
                          <div className="break-all text-sm leading-6 text-[color:var(--ink)]">{me.email}</div>
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        <Label htmlFor="settings-bio">{t("settings.bio")}</Label>
                        <Textarea
                          ref={bioTextareaRef}
                          id="settings-bio"
                          rows={3}
                          value={bio}
                          onChange={(event) => setBio(event.target.value)}
                          onKeyDown={onProfileEditorKeyDown}
                          placeholder={t("settings.bioPlaceholder")}
                          className="min-h-[120px]"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" type="button" onClick={() => setProfileDialogOpen(false)}>
                          {t("settings.cancel")}
                        </Button>
                        <Button type="submit" variant="primary" disabled={profileSaveState === "saving"}>
                          {profileSaveState === "saving" ? "Saving" : t("settings.saved")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </SettingsSection>

        <SettingsSection
          kicker="Security"
          title={t("settings.linkedAccounts")}
          description={t("settings.linkedAccountsDescription")}
        >
          <Card className="border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-none">
            <CardContent className="p-0">
              <div className="grid gap-1">
                {(loginMethods?.methods ?? []).map((method) => {
                  const accountName = formatLoginAccountName(method);
                  return (
                    <div
                      key={method.provider}
                      className="flex items-center justify-between gap-4 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--ink-soft)]">
                          {providerIcon(method.provider)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[color:var(--ink)]">
                            {providerLabel(method.provider, t)}
                          </div>
                          {method.linked && accountName ? (
                            <div className="truncate text-sm text-[color:var(--ink-soft)]">
                              {accountName}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {method.provider === "password" ? (
                        method.linked ? (
                          <Button asChild variant="ghost" size="sm" className="rounded-[var(--radius-sm)] px-3">
                            <a href="/settings/password">{t("auth.changePassword")}</a>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-[var(--radius-sm)] px-3"
                            onClick={() => setIsSettingPassword((current) => !current)}
                          >
                            {t("auth.setPassword")}
                          </Button>
                        )
                      ) : method.linked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-[var(--radius-sm)] px-3"
                          disabled={!method.canUnlink}
                          onClick={() =>
                            void onUnlinkLoginMethod(
                              method.provider as Exclude<ProviderName, "password">,
                            )
                          }
                        >
                          {t("auth.unlink")}
                        </Button>
                      ) : (
                        <SignInButton
                          provider={method.provider as Exclude<ProviderName, "password">}
                          redirectTo="/settings"
                          variant="ghost"
                          size="sm"
                          className="rounded-[var(--radius-sm)] px-3"
                        >
                          {t("auth.link")}
                        </SignInButton>
                      )}
                    </div>
                  );
                })}
              </div>
              {isSettingPassword &&
              !loginMethods?.methods.find((entry) => entry.provider === "password")?.linked ? (
                <form className="mt-5 grid gap-4 border-t border-[color:var(--line)] pt-5" onSubmit={onEnablePassword}>
                  <div className="grid gap-2">
                    <Label htmlFor="settings-setup-password">{t("auth.newPassword")}</Label>
                    <Input
                      id="settings-setup-password"
                      type="password"
                      autoComplete="new-password"
                      value={setupPassword}
                      onChange={(event) => setSetupPassword(event.target.value)}
                      className="rounded-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={!setupPassword} className="rounded-[var(--radius-sm)]">
                      {t("auth.setPassword")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-[var(--radius-sm)]"
                      onClick={() => setIsSettingPassword(false)}
                    >
                      {t("settings.cancel")}
                    </Button>
                  </div>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </SettingsSection>

        <SettingsSection
          kicker="Workspace"
          title={t("settings.organizations")}
          description={t("settings.organizationsDescription")}
        >
          <Card className="border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-none">
            <CardContent className="p-0">
              <div className="grid gap-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {t("settings.organizationCount", { count: orgs.length })}
                  </div>
                  <Dialog open={createOrgDialogOpen} onOpenChange={setCreateOrgDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-[var(--radius-sm)]">
                        {t("settings.createOrg")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("settings.createOrg")}</DialogTitle>
                        <DialogDescription>{t("settings.organizationsDescription")}</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="settings-org-handle">{t("settings.orgHandle")}</Label>
                          <Input
                            id="settings-org-handle"
                            value={orgHandle}
                            onChange={(event) => setOrgHandle(event.target.value)}
                            placeholder={t("settings.orgHandlePlaceholder")}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="settings-org-display-name">{t("settings.orgDisplayName")}</Label>
                          <Input
                            id="settings-org-display-name"
                            value={orgDisplayName}
                            onChange={(event) => setOrgDisplayName(event.target.value)}
                            placeholder={t("settings.orgDisplayNamePlaceholder")}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateOrgDialogOpen(false)}>
                          {t("settings.cancel")}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={!orgHandle.trim()}
                          onClick={() => void onCreateOrg()}
                        >
                          {t("settings.createOrg")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {orgs.length > 0 ? (
                  <>
                    <div className="grid gap-0 border-t border-[color:var(--line)]">
                      {orgs.map((entry) => (
                        <div
                          key={entry.publisher._id}
                          className={`flex items-center justify-between gap-4 border-t border-[color:var(--line)] px-1 py-3 first:border-t-0 ${
                            selectedOrg?.publisher._id === entry.publisher._id
                              ? "bg-[color:var(--surface-muted)]"
                              : ""
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-9 w-9 rounded-[var(--radius-sm)] border border-[color:var(--line)]">
                              {entry.publisher.image ? (
                                <AvatarImage src={entry.publisher.image} alt={entry.publisher.displayName} />
                              ) : null}
                              <AvatarFallback className="rounded-[var(--radius-sm)]">
                                {entry.publisher.displayName[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[color:var(--ink)]">
                                {entry.publisher.displayName}
                              </div>
                              <div className="truncate text-sm text-[color:var(--ink-soft)]">
                                @{entry.publisher.handle} · {t(`settings.roles.${entry.role}`)}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="rounded-[var(--radius-sm)] px-3"
                            onClick={() => setSelectedOrgHandle(entry.publisher.handle)}
                          >
                            {t("settings.manageOrg")}
                          </Button>
                        </div>
                      ))}
                    </div>

                    {selectedOrg ? (
                      <div className="grid gap-3 border-t border-[color:var(--line)] pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[color:var(--ink)]">
                              {t("settings.orgMembers")}
                            </div>
                            <div className="truncate text-sm text-[color:var(--ink-soft)]">
                              {selectedOrg.publisher.displayName} · @{selectedOrg.publisher.handle}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedOrg.role === "owner" ? (
                              <Dialog open={deleteOrgDialogOpen} onOpenChange={setDeleteOrgDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-[var(--radius-sm)] text-red-600 hover:not-disabled:bg-red-50 hover:not-disabled:text-red-700 dark:text-red-300 dark:hover:not-disabled:bg-red-950/40"
                                  >
                                    {t("settings.deleteOrg")}
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>{t("settings.deleteOrgTitle")}</DialogTitle>
                                    <DialogDescription>
                                      {t("settings.deleteOrgDescription")}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="ghost" onClick={() => setDeleteOrgDialogOpen(false)}>
                                      {t("settings.cancel")}
                                    </Button>
                                    <Button variant="destructive" onClick={() => void onDeleteOrg()}>
                                      {t("settings.deleteOrg")}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            ) : null}
                            {selectedOrg.role !== "publisher" ? (
                              <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="rounded-[var(--radius-sm)]">
                                    {t("settings.addMemberAction")}
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>{t("settings.addMember")}</DialogTitle>
                                    <DialogDescription>{selectedOrg.publisher.displayName}</DialogDescription>
                                  </DialogHeader>
                                  <div className="grid gap-4">
                                    <div className="grid gap-2">
                                      <Label htmlFor="settings-add-member">{t("settings.addMember")}</Label>
                                      <Input
                                        id="settings-add-member"
                                        value={memberHandle}
                                        onChange={(event) => setMemberHandle(event.target.value)}
                                        placeholder={t("settings.memberHandlePlaceholder")}
                                      />
                                    </div>
                                    <div className="grid gap-2">
                                      <Label htmlFor="settings-member-role">{t("settings.role")}</Label>
                                      <select
                                        id="settings-member-role"
                                        className="w-full min-h-[44px] rounded-[var(--radius-sm)] border border-[rgba(29,59,78,0.22)] bg-[rgba(255,255,255,0.94)] px-3.5 py-[13px] text-[color:var(--ink)] transition-all duration-[180ms] ease-out focus:outline-none focus:border-[color-mix(in_srgb,var(--accent)_70%,white)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)] dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(14,28,37,0.84)]"
                                        value={memberRole}
                                        onChange={(event) => setMemberRole(event.target.value as typeof memberRole)}
                                      >
                                        <option value="publisher">{t("settings.roles.publisher")}</option>
                                        <option value="admin">{t("settings.roles.admin")}</option>
                                        <option value="owner">{t("settings.roles.owner")}</option>
                                      </select>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="ghost" onClick={() => setAddMemberDialogOpen(false)}>
                                      {t("settings.cancel")}
                                    </Button>
                                    <Button
                                      disabled={!memberHandle.trim()}
                                      onClick={() =>
                                        void addOrgMember({
                                          publisherId: selectedOrg.publisher._id,
                                          userHandle: memberHandle,
                                          role: memberRole,
                                        }).then(() => {
                                          setMemberHandle("");
                                          setAddMemberDialogOpen(false);
                                        })
                                      }
                                    >
                                      {t("settings.addMemberAction")}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            ) : null}
                          </div>
                        </div>

                        {(orgMembers?.members ?? []).length ? (
                          <div className="grid gap-0">
                            {orgMembers?.members.map((entry) => (
                              <div
                                key={`${entry.user._id}:${entry.role}`}
                                className="flex flex-col gap-3 border-t border-[color:var(--line)] py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <Avatar className="h-9 w-9 rounded-[var(--radius-sm)] border border-[color:var(--line)]">
                                    {entry.user.image ? (
                                      <AvatarImage src={entry.user.image} alt={entry.user.displayName ?? "user"} />
                                    ) : null}
                                    <AvatarFallback className="rounded-[var(--radius-sm)]">
                                      {(entry.user.displayName ?? entry.user.handle ?? "U")[0]?.toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-[color:var(--ink)]">
                                      {entry.user.displayName ?? entry.user.handle ?? entry.user._id}
                                    </div>
                                    <div className="text-sm text-[color:var(--ink-soft)]">
                                      @{entry.user.handle ?? "user"} · {t(`settings.roles.${entry.role}`)}
                                    </div>
                                  </div>
                                </div>
                                {selectedOrg.role !== "publisher" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    className="rounded-[var(--radius-sm)] text-[color:var(--ink-soft)]"
                                    onClick={() =>
                                      void removeOrgMember({
                                        publisherId: selectedOrg.publisher._id,
                                        userId: entry.user._id,
                                      })
                                    }
                                  >
                                    {t("settings.remove")}
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="border-t border-[color:var(--line)] pt-4">
                    <p className="text-sm leading-6 text-[color:var(--ink-soft)]">
                      {t("settings.noOrganizations")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </SettingsSection>

        <SettingsSection
          kicker="Access"
          title={t("settings.apiTokens")}
          description={t("settings.apiTokensDescription")}
        >
          <Card className="border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-none">
            <CardContent className="p-0">
              <div className="grid gap-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {t("settings.tokenCount", { count: activeTokens.length })}
                  </div>
                  <Dialog open={createTokenDialogOpen} onOpenChange={onCreateTokenDialogOpenChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-[var(--radius-sm)]">
                        {t("settings.createToken")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="gap-4">
                      <DialogHeader>
                        <DialogTitle>{t("settings.createToken")}</DialogTitle>
                        <DialogDescription>{t("settings.apiTokensDescription")}</DialogDescription>
                      </DialogHeader>
                      {createdTokenValue ? (
                        <>
                          <div className="grid gap-2 rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
                              {t("settings.copyTokenNow")}
                            </div>
                            <code className="block break-all rounded-[var(--radius-sm)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm leading-6 text-[color:var(--ink)]">
                              {createdTokenValue}
                            </code>
                          </div>
                          <DialogFooter className="pt-0">
                            <Button
                              variant="outline"
                              className="rounded-[var(--radius-sm)]"
                              onClick={() => void copyText(createdTokenValue, t("settings.tokenCopied"))}
                            >
                              {t("settings.copyToken")}
                            </Button>
                            <Button
                              variant="ghost"
                              className="rounded-[var(--radius-sm)] px-4"
                              onClick={() => {
                                setCreateTokenDialogOpen(false);
                                setCreatedTokenValue("");
                                setTokenLabel("");
                              }}
                            >
                              {t("settings.saved")}
                            </Button>
                          </DialogFooter>
                        </>
                      ) : (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="settings-token-label">{t("settings.label")}</Label>
                            <Input
                              id="settings-token-label"
                              value={tokenLabel}
                              onChange={(event) => setTokenLabel(event.target.value)}
                              placeholder={t("cliAuth.tokenLabel")}
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="ghost" onClick={() => setCreateTokenDialogOpen(false)}>
                              {t("settings.cancel")}
                            </Button>
                            <Button variant="primary" onClick={() => void onCreateToken()}>
                              {t("settings.createToken")}
                            </Button>
                          </DialogFooter>
                        </>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
                {activeTokens.length ? (
                  <div className="grid gap-0 border-t border-[color:var(--line)]">
                    {activeTokens.map((token) => (
                      <div
                        key={token._id}
                        className="grid gap-3 border-t border-[color:var(--line)] py-3 first:border-t-0 sm:grid-cols-[minmax(120px,180px)_minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0 text-sm font-semibold text-[color:var(--ink)]">{token.label}</div>
                        <div className="flex min-w-0 items-center gap-2">
                          <code className="block min-w-0 truncate text-sm text-[color:var(--ink-soft)]">
                            {getTokenDisplayValue(token)}
                          </code>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="h-9 w-9 rounded-[var(--radius-sm)] text-[color:var(--ink)]"
                            onClick={() => openRenameTokenDialog(token)}
                            aria-label={t("settings.renameToken")}
                            title={t("settings.renameToken")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="h-9 w-9 rounded-[var(--radius-sm)] text-[color:var(--ink)]"
                            onClick={() => confirmRevokeToken(token)}
                            aria-label={t("settings.deleteToken")}
                            title={t("settings.deleteToken")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[color:var(--ink-soft)]">{t("settings.noTokens")}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Dialog open={renameTokenDialogOpen} onOpenChange={setRenameTokenDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("settings.renameToken")}</DialogTitle>
                <DialogDescription>{t("settings.apiTokensDescription")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="settings-rename-token-label">{t("settings.label")}</Label>
                <Input
                  id="settings-rename-token-label"
                  value={renamingToken?.label ?? ""}
                  onChange={(event) =>
                    setRenamingToken((current) =>
                      current ? { ...current, label: event.target.value } : current,
                    )
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRenameTokenDialogOpen(false)}>
                  {t("settings.cancel")}
                </Button>
                <Button
                  variant="primary"
                  disabled={!renamingToken?.label.trim()}
                  onClick={() => void onRenameToken()}
                >
                  {t("settings.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SettingsSection>

        <section className="border-t border-[color:var(--line)] pt-8">
          <Card className="border-red-200 bg-red-50/55 p-5 shadow-none dark:border-red-900/45 dark:bg-red-950/20">
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    <Power className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
                      {t("settings.dangerZone")}
                    </h2>
                    <p className="text-sm leading-6 text-red-900/65 dark:text-red-100/65">
                      {t("settings.dangerZoneDescription")}
                    </p>
                  </div>
                </div>
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      type="button"
                      className="shrink-0 rounded-[var(--radius-sm)]"
                    >
                      {t("settings.deleteAccount")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("settings.deleteAccountTitle")}</DialogTitle>
                      <DialogDescription>{t("settings.deleteAccountDescription")}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
                        {t("settings.cancel")}
                      </Button>
                      <Button variant="destructive" onClick={() => void onDelete()}>
                        {t("settings.deleteAccount")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </Container>
  );
}
