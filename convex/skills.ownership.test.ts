import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
  authTables: {},
}));

const { getAuthUserId } = await import("@convex-dev/auth/server");
const { getSkillBySlugInternal, grantAccess, revokeAccess, setVisibility } = await import(
  "./skills"
);

type WrappedHandler<TArgs, TResult = unknown> = {
  _handler: (ctx: unknown, args: TArgs) => Promise<TResult>;
};

const getSkillBySlugInternalHandler = (
  getSkillBySlugInternal as unknown as WrappedHandler<{ slug: string }>
)._handler;
const setVisibilityHandler = (
  setVisibility as unknown as WrappedHandler<{ skillId: string; visibility: string }>
)._handler;
const grantAccessHandler = (
  grantAccess as unknown as WrappedHandler<{
    skillId: string;
    subjectType: "user" | "publisher";
    userHandle?: string;
    publisherHandle?: string;
  }>
)._handler;
const revokeAccessHandler = (revokeAccess as unknown as WrappedHandler<{ grantId: string }>)
  ._handler;

beforeEach(() => {
  vi.mocked(getAuthUserId).mockReset();
});

function makeAccessCtx(args: {
  actor: Record<string, unknown>;
  skill: Record<string, unknown>;
  targetUser?: Record<string, unknown> | null;
  targetPublisher?: Record<string, unknown> | null;
  grant?: Record<string, unknown> | null;
  publisherMember?: Record<string, unknown> | null;
}) {
  const patch = vi.fn();
  const replace = vi.fn();
  const insert = vi.fn(async (table: string, _value: Record<string, unknown>) => `${table}:new`);
  const deleteFn = vi.fn();
  const get = vi.fn(async (id: string) => {
    if (id === args.actor._id) return args.actor;
    if (id === args.skill._id) return args.skill;
    if (args.targetUser && id === args.targetUser._id) return args.targetUser;
    if (args.targetPublisher && id === args.targetPublisher._id) return args.targetPublisher;
    if (args.grant && id === args.grant._id) return args.grant;
    return null;
  });
  const query = vi.fn((table: string) => ({
    withIndex: vi.fn(() => ({
      unique: vi.fn(async () => {
        if (table === "publisherMembers") return args.publisherMember ?? null;
        if (table === "users") return args.targetUser ?? null;
        if (table === "publishers") return args.targetPublisher ?? null;
        if (table === "skillAccessGrants") return args.grant ?? null;
        return null;
      }),
      collect: vi.fn(async () => []),
    })),
  }));
  return {
    ctx: {
      db: {
        get,
        query,
        patch,
        replace,
        insert,
        delete: deleteFn,
        normalizeId: vi.fn((table: string, id: string) =>
          id.startsWith(`${table}:`) ? id : null,
        ),
        system: {},
      },
    } as never,
    get,
    query,
    patch,
    insert,
    deleteFn,
  };
}

describe("skills ownership", () => {
  it("resolves alias slugs to the live target skill", async () => {
    const result = await getSkillBySlugInternalHandler(
      {
        db: {
          get: vi.fn(async (id: string) => {
            if (id === "skills:target") {
              return {
                _id: "skills:target",
                slug: "demo",
                ownerUserId: "users:1",
              };
            }
            return null;
          }),
          query: vi.fn((table: string) => {
            if (table === "skills") {
              return {
                withIndex: (name: string) => {
                  if (name !== "by_slug") throw new Error(`unexpected skills index ${name}`);
                  return {
                    unique: async () => null,
                  };
                },
              };
            }
            if (table === "skillSlugAliases") {
              return {
                withIndex: (name: string) => {
                  if (name !== "by_slug") throw new Error(`unexpected alias index ${name}`);
                  return {
                    unique: async () => ({
                      _id: "skillSlugAliases:1",
                      slug: "demo-old",
                      skillId: "skills:target",
                    }),
                  };
                },
              };
            }
            throw new Error(`unexpected table ${table}`);
          }),
        },
      } as never,
      { slug: "demo-old" } as never,
    );

    expect(result).toEqual(
      expect.objectContaining({
        _id: "skills:target",
        slug: "demo",
      }),
    );
  });

  it("lets the owner set skill visibility", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("users:owner" as never);
    const { ctx, patch, insert } = makeAccessCtx({
      actor: { _id: "users:owner", role: "user" },
      skill: {
        _id: "skills:1",
        ownerUserId: "users:owner",
        ownerPublisherId: undefined,
        visibility: undefined,
        softDeletedAt: undefined,
        moderationStatus: "active",
        moderationFlags: undefined,
      },
    });

    await expect(
      setVisibilityHandler(ctx, { skillId: "skills:1", visibility: "restricted" } as never),
    ).resolves.toEqual({ ok: true, visibility: "restricted" });
    expect(patch).toHaveBeenCalledWith(
      "skills",
      "skills:1",
      expect.objectContaining({ visibility: "restricted" }),
    );
    expect(insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({ action: "skill.visibility.set" }),
    );
  });

  it("rejects visibility changes from non-owners", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("users:other" as never);
    const { ctx, patch } = makeAccessCtx({
      actor: { _id: "users:other", role: "user" },
      skill: {
        _id: "skills:1",
        ownerUserId: "users:owner",
        ownerPublisherId: undefined,
        visibility: undefined,
      },
    });

    await expect(
      setVisibilityHandler(ctx, { skillId: "skills:1", visibility: "private" } as never),
    ).rejects.toThrow("Forbidden");
    expect(patch).not.toHaveBeenCalled();
  });

  it("lets publisher admins grant user access", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("users:admin" as never);
    const { ctx, insert } = makeAccessCtx({
      actor: { _id: "users:admin", role: "user" },
      skill: {
        _id: "skills:1",
        ownerUserId: "users:owner",
        ownerPublisherId: "publishers:org",
      },
      publisherMember: { _id: "publisherMembers:1", role: "admin" },
      targetUser: { _id: "users:viewer", handle: "viewer" },
      grant: null,
    });

    await expect(
      grantAccessHandler(ctx, {
        skillId: "skills:1",
        subjectType: "user",
        userHandle: "viewer",
      } as never),
    ).resolves.toEqual({
      ok: true,
      grantId: "skillAccessGrants:new",
      alreadyGranted: false,
    });
    expect(insert).toHaveBeenCalledWith(
      "skillAccessGrants",
      expect.objectContaining({ subjectUserId: "users:viewer" }),
    );
  });

  it("lets managers revoke access grants", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("users:owner" as never);
    const { ctx, deleteFn } = makeAccessCtx({
      actor: { _id: "users:owner", role: "user" },
      skill: { _id: "skills:1", ownerUserId: "users:owner" },
      grant: {
        _id: "skillAccessGrants:1",
        skillId: "skills:1",
        subjectType: "user",
        subjectUserId: "users:viewer",
      },
    });

    await expect(
      revokeAccessHandler(ctx, { grantId: "skillAccessGrants:1" } as never),
    ).resolves.toEqual({ ok: true });
    expect(deleteFn).toHaveBeenCalledWith("skillAccessGrants:1");
  });
});
