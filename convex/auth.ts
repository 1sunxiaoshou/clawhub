import GitHub, { type GitHubEmail, type GitHubProfile } from "@auth/core/providers/github";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, createAccount, getAuthUserId, retrieveAccount } from "@convex-dev/auth/server";
import type { OAuthConfig } from "@auth/core/providers";
import type { GenericMutationCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { shouldScheduleGitHubProfileSync } from "./lib/githubProfileSync";

export const BANNED_REAUTH_MESSAGE =
  "This account has been banned and cannot sign in. If you believe this is a mistake, please contact security@openclaw.ai and we will review it.";
export const DELETED_ACCOUNT_REAUTH_MESSAGE =
  "This account has been permanently deleted and cannot be restored.";

const REAUTH_BLOCKING_BAN_ACTIONS = new Set(["user.ban", "user.autoban.malware"]);
const ADMIN_HANDLE = "steipete";

type LoginMethod = "password" | "wecom" | "github";
type AuthProviderId = LoginMethod;

export function getLoginMethodForProvider(providerId: AuthProviderId): LoginMethod {
  return providerId;
}

function getBannedReauthMessage(reason: string | undefined) {
  const normalizedReason = reason?.trim();
  if (!normalizedReason || normalizedReason.toLowerCase() === "malware auto-ban") {
    return BANNED_REAUTH_MESSAGE;
  }
  return `${BANNED_REAUTH_MESSAGE} Reason: ${normalizedReason}`;
}

export async function handleDeletedUserSignIn(
  ctx: GenericMutationCtx<DataModel>,
  args: { userId: Id<"users">; existingUserId: Id<"users"> | null },
  userOverride?: {
    deletedAt?: number;
    deactivatedAt?: number;
    purgedAt?: number;
    banReason?: string;
  } | null,
) {
  const user = userOverride !== undefined ? userOverride : await ctx.db.get(args.userId);
  if (!user?.deletedAt && !user?.deactivatedAt) return;

  if (args.existingUserId && args.existingUserId !== args.userId) {
    return;
  }

  if (user.deactivatedAt) {
    throw new ConvexError(DELETED_ACCOUNT_REAUTH_MESSAGE);
  }

  const userId = args.userId;
  const deletedAt = user.deletedAt ?? Date.now();
  const banRecords = await ctx.db
    .query("auditLogs")
    .withIndex("by_target", (q) => q.eq("targetType", "user").eq("targetId", userId.toString()))
    .collect();

  const hasBlockingBan = banRecords.some((record) =>
    REAUTH_BLOCKING_BAN_ACTIONS.has(record.action),
  );

  if (hasBlockingBan) {
    throw new ConvexError(getBannedReauthMessage(user.banReason));
  }

  await ctx.db.patch(userId, {
    deletedAt: undefined,
    deactivatedAt: deletedAt,
    purgedAt: user.purgedAt ?? deletedAt,
    updatedAt: Date.now(),
  });

  throw new ConvexError(DELETED_ACCOUNT_REAUTH_MESSAGE);
}

function normalizeEmail(email: unknown) {
  if (typeof email !== "string") return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeHandleCandidate(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || undefined;
}

async function findVerifiedEmailUserId(
  ctx: GenericMutationCtx<DataModel>,
  email: string | undefined,
) {
  if (!email) return null;
  const matches = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
    .take(2);
  return matches.length === 1 ? matches[0]!._id : null;
}

async function schedulePostAuthWork(
  ctx: GenericMutationCtx<DataModel>,
  user: Doc<"users"> | null,
  method: LoginMethod,
) {
  if (!user) return;
  const now = Date.now();
  const patch: Partial<Doc<"users">> = {
    lastLoginAt: now,
    lastLoginMethod: method,
    updatedAt: now,
  };
  if (!user.primaryLoginMethod) {
    patch.primaryLoginMethod = method;
  }
  if (method === "password" && !user.passwordEnabled) {
    patch.passwordEnabled = true;
  }
  await ctx.db.patch(user._id, patch);
  await ctx.scheduler.runAfter(0, internal.publishers.ensurePersonalPublisherInternal, {
    userId: user._id,
  });
  if (method === "github" && shouldScheduleGitHubProfileSync({ ...user, ...patch }, now)) {
    await ctx.scheduler.runAfter(0, internal.users.syncGitHubProfileAction, {
      userId: user._id,
    });
  }
}

function buildUserProfilePatch(
  user: Doc<"users"> | null,
  profile: Record<string, unknown> & { email?: string; emailVerified?: boolean },
  method: LoginMethod,
) {
  const email = normalizeEmail(profile.email);
  const name = normalizeDisplayName(profile.name);
  const displayName =
    normalizeDisplayName(profile.displayName) ??
    (method === "github" ? undefined : name);
  const image = normalizeDisplayName(profile.image);
  const requestedHandle = normalizeHandleCandidate(profile.handle);
  const patch: Partial<Doc<"users">> = {};

  if (email && user?.email !== email) {
    patch.email = email;
  }
  if (profile.emailVerified && email && !user?.emailVerificationTime) {
    patch.emailVerificationTime = Date.now();
  }
  if (name && (method === "github" || !user?.name)) {
    patch.name = name;
  }
  if (image && image !== user?.image) {
    patch.image = image;
  }
  if (requestedHandle && !user?.handle) {
    patch.handle = requestedHandle;
  }

  const existingDisplayName = normalizeDisplayName(user?.displayName);
  const existingName = normalizeDisplayName(user?.name);
  const existingHandle = normalizeDisplayName(user?.handle);
  const canReplaceDisplayName =
    !existingDisplayName ||
    existingDisplayName === existingName ||
    existingDisplayName === existingHandle;
  if (displayName && (canReplaceDisplayName || !user)) {
    patch.displayName = displayName;
  }

  if (!user?.role) {
    const effectiveHandle = patch.handle ?? user?.handle;
    patch.role = effectiveHandle === ADMIN_HANDLE ? "admin" : "user";
  }
  if (!user?.createdAt) {
    patch.createdAt = user?._creationTime ?? Date.now();
  }
  return patch;
}

async function createOrUpdateAuthUser(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    existingUserId: Id<"users"> | null;
    providerId: AuthProviderId;
    profile: Record<string, unknown> & {
      email?: string;
      emailVerified?: boolean;
    };
  },
) {
  const loginMethod = getLoginMethodForProvider(args.providerId);
  const currentAuthUserId = (await getAuthUserId(ctx)) as Id<"users"> | null;

  if (
    currentAuthUserId &&
    args.existingUserId &&
    args.existingUserId !== currentAuthUserId
  ) {
    throw new ConvexError("This login method is already linked to another account.");
  }

  const verifiedEmailUserId =
    args.profile.emailVerified === true
      ? await findVerifiedEmailUserId(ctx, normalizeEmail(args.profile.email))
      : null;
  const targetUserId = args.existingUserId ?? currentAuthUserId ?? verifiedEmailUserId;
  const currentUser = targetUserId ? await ctx.db.get(targetUserId) : null;
  const userPatch = buildUserProfilePatch(currentUser, args.profile, loginMethod);

  let userId = targetUserId;
  if (userId) {
    if (Object.keys(userPatch).length > 0) {
      await ctx.db.patch(userId, {
        ...userPatch,
        updatedAt: Date.now(),
      });
    }
  } else {
    userId = await ctx.db.insert("users", userPatch);
  }

  const user = await ctx.db.get(userId);
  await schedulePostAuthWork(ctx, user, loginMethod);
  return userId;
}

async function fetchGitHubProfileWithVerifiedEmail(tokens: { access_token?: string }) {
  const accessToken = tokens.access_token;
  if (!accessToken) {
    throw new Error("Missing GitHub access token");
  }
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "authjs",
  };
  const profile = (await fetch("https://api.github.com/user", { headers }).then((res) =>
    res.json(),
  )) as GitHubProfile;
  const emails = (await fetch("https://api.github.com/user/emails", { headers }).then((res) =>
    (res.ok ? res.json() : []),
  )) as GitHubEmail[];
  const verifiedEmail =
    emails.find((email) => email.primary && email.verified) ??
    emails.find((email) => email.verified) ??
    null;
  return {
    profile,
    email: verifiedEmail?.email ?? profile.email ?? undefined,
    emailVerified: Boolean(verifiedEmail?.verified),
  };
}

function createGitHubProvider() {
  return GitHub({
    clientId: process.env.AUTH_GITHUB_ID ?? "",
    clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
    userinfo: {
      async request({ tokens }: { tokens: { access_token?: string } }) {
        return await fetchGitHubProfileWithVerifiedEmail(tokens);
      },
    },
    profile(data) {
      const payload = data as unknown as {
        profile: GitHubProfile;
        email?: string;
        emailVerified?: boolean;
      };
      return {
        id: String(payload.profile.id),
        name: payload.profile.login,
        email: payload.email,
        emailVerified: payload.emailVerified,
        displayName: payload.profile.name ?? payload.profile.login,
        handle: payload.profile.login,
        image: payload.profile.avatar_url,
      };
    },
  });
}

function createWeComProvider(): OAuthConfig<Record<string, unknown>> {
  const corpId = process.env.AUTH_WECOM_CORP_ID ?? "";
  const agentId = process.env.AUTH_WECOM_AGENT_ID ?? "";
  const corpSecret = process.env.AUTH_WECOM_SECRET ?? "";

  return {
    id: "wecom",
    name: "WeCom",
    type: "oauth",
    checks: ["state"],
    clientId: corpId,
    clientSecret: corpSecret,
    authorization: {
      url: "https://open.weixin.qq.com/connect/oauth2/authorize",
      params: {
        appid: corpId,
        response_type: "code",
        scope: "snsapi_base",
        agentid: agentId,
      },
    },
    token: {
      async request({ params }: { params: { code?: string } }) {
        const code = typeof params.code === "string" ? params.code : "";
        const tokenResponse = await fetch(
          `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(corpSecret)}`,
        ).then((res) => res.json());
        if (!tokenResponse?.access_token) {
          throw new Error(tokenResponse?.errmsg ?? "Failed to obtain WeCom access token");
        }
        const userInfo = await fetch(
          `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${encodeURIComponent(tokenResponse.access_token)}&code=${encodeURIComponent(code)}`,
        ).then((res) => res.json());
        if (!userInfo?.UserId) {
          throw new Error(userInfo?.errmsg ?? "Failed to obtain WeCom user info");
        }
        return {
          tokens: {
            access_token: tokenResponse.access_token as string,
            userid: userInfo.UserId as string,
            token_type: "bearer",
          },
        };
      },
    },
    userinfo: {
      async request({ tokens }: { tokens: { access_token?: string; userid?: string } }) {
        const accessToken = typeof tokens.access_token === "string" ? tokens.access_token : "";
        const userId = typeof tokens.userid === "string" ? tokens.userid : "";
        const response = await fetch(
          `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${encodeURIComponent(accessToken)}&userid=${encodeURIComponent(userId)}`,
        ).then((res) => res.json());
        return {
          ...response,
          corpId,
          userId,
        };
      },
    },
    profile(profile) {
      const email = normalizeEmail(profile.email) ?? normalizeEmail(profile.biz_mail);
      const userId =
        typeof profile.userId === "string" ? profile.userId : normalizeDisplayName(profile.userid);
      return {
        id: `${corpId}:${userId ?? ""}`,
        name:
          normalizeDisplayName(profile.name) ??
          normalizeDisplayName(profile.alias) ??
          userId ??
          "wecom-user",
        displayName:
          normalizeDisplayName(profile.name) ??
          normalizeDisplayName(profile.alias) ??
          userId ??
          "WeCom User",
        email,
        emailVerified: Boolean(email),
        image: normalizeDisplayName(profile.avatar),
      };
    },
  };
}

function createPasswordProvider() {
  return ConvexCredentials({
    id: "password",
    authorize: async (params, ctx) => {
      const flow = params.flow as string;
      const email = normalizeEmail(params.email);
      if (!email) {
        throw new Error("Email is required");
      }

      if (flow === "signUp") {
        const password = params.password as string | undefined;
        if (!password || password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
        const created = await createOrUpdatePasswordAccount(ctx, {
          email,
          password,
        });
        await ctx.runMutation(internal.users.recordLoginMetadataInternal, {
          userId: created.user._id,
          method: "password",
          passwordEnabled: true,
        });
        return { userId: created.user._id };
      }

      if (flow === "signIn") {
        const password = params.password as string | undefined;
        if (!password) {
          throw new Error("Password is required");
        }
        const retrieved = await retrieveAccount(ctx, {
          provider: "password",
          account: { id: email, secret: password },
        });
        await ctx.runMutation(internal.users.recordLoginMetadataInternal, {
          userId: retrieved.user._id,
          method: "password",
          passwordEnabled: true,
        });
        return { userId: retrieved.user._id };
      }

      throw new Error(
        'Missing `flow` param, it must be one of "signUp" or "signIn"!',
      );
    },
    crypto: {
      async hashSecret(password: string) {
        return await new Scrypt().hash(password);
      },
      async verifySecret(password: string, hash: string) {
        return await new Scrypt().verify(hash, password);
      },
    },
  });
}

async function createOrUpdatePasswordAccount(
  ctx: ActionCtx,
  args: { email: string; password: string },
) {
  return await createAccount(ctx, {
    provider: "password",
    account: { id: args.email, secret: args.password },
    profile: { email: args.email },
    shouldLinkViaEmail: true,
  });
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [createGitHubProvider(), createWeComProvider(), createPasswordProvider()],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      return await createOrUpdateAuthUser(ctx, {
        existingUserId: args.existingUserId,
        providerId: args.provider.id as AuthProviderId,
        profile: args.profile,
      });
    },
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId);
      await handleDeletedUserSignIn(ctx, { userId, existingUserId: userId }, user);
    },
  },
});
