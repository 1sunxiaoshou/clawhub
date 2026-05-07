/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
  authTables: {},
}));

vi.mock("./lib/badges", () => ({
  getSkillBadgeMap: vi.fn(),
  getSkillBadgeMaps: vi.fn(),
  isSkillHighlighted: vi.fn(),
}));

const { getAuthUserId } = await import("@convex-dev/auth/server");
const { getSkillBadgeMap } = await import("./lib/badges");
const { getBySlug } = await import("./skills");

type WrappedHandler<TArgs, TResult = unknown> = {
  _handler: (ctx: unknown, args: TArgs) => Promise<TResult>;
};

const getBySlugHandler = (
  getBySlug as unknown as WrappedHandler<
    {
      slug: string;
    },
    {
      skill?: { slug?: string } | null;
      owner?: Record<string, unknown> | null;
      access?: { visibility: string; granted: boolean; canManage: boolean };
    } | null
  >
)._handler;

function makeCtx(args: {
  skill: Record<string, unknown> | null;
  owner: Record<string, unknown> | null;
  actor?: Record<string, unknown> | null;
  latestVersion?: Record<string, unknown> | null;
  grants?: Array<Record<string, unknown>>;
  publisherMemberships?: Array<Record<string, unknown>>;
}) {
  const unique = vi.fn().mockResolvedValue(args.skill);
  const withIndex = vi.fn(() => ({ unique, collect: vi.fn().mockResolvedValue([]) }));
  const query = vi.fn((table: string) => {
    if (table === "skills") return { withIndex };
    if (table === "publisherMembers") {
      return {
        withIndex: vi.fn(() => ({
          unique: vi.fn().mockResolvedValue(null),
          collect: vi.fn().mockResolvedValue(args.publisherMemberships ?? []),
        })),
      };
    }
    if (table === "skillAccessGrants") {
      return {
        withIndex: vi.fn((indexName: string) => ({
          unique: vi.fn(async () => {
            if (indexName === "by_skill_user") {
              return (
                args.grants?.find((grant) => grant.subjectUserId === args.actor?._id) ?? null
              );
            }
            if (indexName === "by_skill_publisher") {
              return (
                args.grants?.find((grant) =>
                  args.publisherMemberships?.some(
                    (membership) => membership.publisherId === grant.subjectPublisherId,
                  ),
                ) ?? null
              );
            }
            return args.grants?.[0] ?? null;
          }),
          collect: vi.fn().mockResolvedValue(args.grants ?? []),
        })),
      };
    }
    throw new Error(`Unexpected query table: ${table}`);
  });
  const get = vi.fn(async (id: string) => {
    if (!args.skill) return null;
    if (id === args.skill.ownerUserId) return args.owner;
    if (args.actor && id === args.actor._id) return args.actor;
    if (id === args.skill.latestVersionId) return args.latestVersion ?? null;
    return null;
  });
  return { db: { query, get } } as never;
}

describe("skills.getBySlug", () => {
  beforeEach(() => {
    vi.mocked(getAuthUserId).mockReset();
    vi.mocked(getSkillBadgeMap).mockReset();
    vi.mocked(getAuthUserId).mockResolvedValue(null as never);
    vi.mocked(getSkillBadgeMap).mockResolvedValue({} as never);
  });

  it("sanitizes owner fields in the public response", async () => {
    const ctx = makeCtx({
      skill: {
        _id: "skills:1",
        _creationTime: 1,
        slug: "demo",
        displayName: "Demo",
        summary: "Public demo skill",
        ownerUserId: "users:1",
        canonicalSkillId: undefined,
        forkOf: undefined,
        latestVersionId: null,
        tags: {},
        stats: {
          downloads: 10,
          installsCurrent: 2,
          installsAllTime: 5,
          stars: 3,
          versions: 1,
          comments: 0,
        },
        createdAt: 1,
        updatedAt: 2,
        moderationStatus: "active",
        moderationFlags: undefined,
        softDeletedAt: undefined,
      },
      owner: {
        _id: "users:1",
        _creationTime: 1,
        handle: "demo-owner",
        name: "Demo Owner",
        displayName: "Demo Owner",
        image: null,
        bio: "Ships demo skills",
        email: "owner@example.com",
        emailVerificationTime: 123,
        githubCreatedAt: 456,
        githubFetchedAt: 789,
        githubProfileSyncedAt: 999,
      },
    });

    const result = await getBySlugHandler(ctx, { slug: "demo" } as never);

    expect(result?.owner).toEqual({
      _id: "publishers:demo-owner",
      _creationTime: 1,
      kind: "user",
      handle: "demo-owner",
      displayName: "Demo Owner",
      image: null,
      bio: "Ships demo skills",
      linkedUserId: "users:1",
    });
    expect(result?.owner).not.toHaveProperty("email");
    expect(result?.owner).not.toHaveProperty("emailVerificationTime");
    expect(result?.owner).not.toHaveProperty("githubCreatedAt");
    expect(result?.owner).not.toHaveProperty("githubFetchedAt");
    expect(result?.owner).not.toHaveProperty("githubProfileSyncedAt");
  });

  it("hides skills whose owner is deleted or banned", async () => {
    const ctx = makeCtx({
      skill: {
        _id: "skills:1",
        _creationTime: 1,
        slug: "demo",
        displayName: "Demo",
        summary: "Public demo skill",
        ownerUserId: "users:1",
        canonicalSkillId: undefined,
        forkOf: undefined,
        latestVersionId: null,
        tags: {},
        stats: {
          downloads: 10,
          installsCurrent: 2,
          installsAllTime: 5,
          stars: 3,
          versions: 1,
          comments: 0,
        },
        createdAt: 1,
        updatedAt: 2,
        moderationStatus: "active",
        moderationFlags: undefined,
        softDeletedAt: undefined,
      },
      owner: {
        _id: "users:1",
        _creationTime: 1,
        handle: "demo-owner",
        name: "Demo Owner",
        displayName: "Demo Owner",
        image: null,
        deletedAt: 123,
      },
    });

    const result = await getBySlugHandler(ctx, { slug: "demo" } as never);

    expect(result).toBeNull();
  });

  it("hides restricted skills from anonymous callers", async () => {
    const ctx = makeCtx({
      skill: {
        _id: "skills:1",
        _creationTime: 1,
        slug: "demo",
        displayName: "Demo",
        summary: "Restricted demo skill",
        ownerUserId: "users:1",
        canonicalSkillId: undefined,
        forkOf: undefined,
        latestVersionId: null,
        tags: {},
        visibility: "restricted",
        stats: {
          downloads: 10,
          installsCurrent: 2,
          installsAllTime: 5,
          stars: 3,
          versions: 1,
          comments: 0,
        },
        createdAt: 1,
        updatedAt: 2,
        moderationStatus: "active",
        moderationFlags: undefined,
        softDeletedAt: undefined,
      },
      owner: {
        _id: "users:1",
        _creationTime: 1,
        handle: "demo-owner",
        name: "Demo Owner",
        displayName: "Demo Owner",
      },
    });

    await expect(getBySlugHandler(ctx, { slug: "demo" } as never)).resolves.toBeNull();
  });

  it("allows directly granted users to read restricted skills", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("users:viewer" as never);
    const ctx = makeCtx({
      skill: {
        _id: "skills:1",
        _creationTime: 1,
        slug: "demo",
        displayName: "Demo",
        summary: "Restricted demo skill",
        ownerUserId: "users:1",
        canonicalSkillId: undefined,
        forkOf: undefined,
        latestVersionId: null,
        tags: {},
        visibility: "restricted",
        stats: {
          downloads: 10,
          installsCurrent: 2,
          installsAllTime: 5,
          stars: 3,
          versions: 1,
          comments: 0,
        },
        createdAt: 1,
        updatedAt: 2,
        moderationStatus: "active",
        moderationFlags: undefined,
        softDeletedAt: undefined,
      },
      owner: {
        _id: "users:1",
        _creationTime: 1,
        handle: "demo-owner",
        name: "Demo Owner",
        displayName: "Demo Owner",
      },
      actor: {
        _id: "users:viewer",
        role: "user",
      },
      grants: [
        {
          _id: "skillAccessGrants:1",
          skillId: "skills:1",
          subjectType: "user",
          subjectUserId: "users:viewer",
          createdByUserId: "users:1",
          createdAt: 1,
        },
      ],
    });

    const result = await getBySlugHandler(ctx, { slug: "demo" } as never);

    expect(result?.skill?.slug).toBe("demo");
    expect((result as { access?: { visibility: string; granted: boolean } })?.access).toEqual({
      visibility: "restricted",
      granted: true,
      canManage: false,
    });
  });

  it("allows members of granted publishers to read restricted skills", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("users:member" as never);
    const ctx = makeCtx({
      skill: {
        _id: "skills:1",
        _creationTime: 1,
        slug: "demo",
        displayName: "Demo",
        summary: "Restricted demo skill",
        ownerUserId: "users:1",
        ownerPublisherId: "publishers:owner",
        canonicalSkillId: undefined,
        forkOf: undefined,
        latestVersionId: null,
        tags: {},
        visibility: "restricted",
        stats: {
          downloads: 10,
          installsCurrent: 2,
          installsAllTime: 5,
          stars: 3,
          versions: 1,
          comments: 0,
        },
        createdAt: 1,
        updatedAt: 2,
        moderationStatus: "active",
        moderationFlags: undefined,
        softDeletedAt: undefined,
      },
      owner: {
        _id: "users:1",
        _creationTime: 1,
        handle: "demo-owner",
        name: "Demo Owner",
        displayName: "Demo Owner",
      },
      actor: {
        _id: "users:member",
        role: "user",
      },
      publisherMemberships: [
        {
          _id: "publisherMembers:viewer",
          userId: "users:member",
          publisherId: "publishers:viewer-org",
          role: "publisher",
        },
      ],
      grants: [
        {
          _id: "skillAccessGrants:1",
          skillId: "skills:1",
          subjectType: "publisher",
          subjectPublisherId: "publishers:viewer-org",
          createdByUserId: "users:1",
          createdAt: 1,
        },
      ],
    });

    const result = await getBySlugHandler(ctx, { slug: "demo" } as never);

    expect(result?.skill?.slug).toBe("demo");
    expect(result?.access?.visibility).toBe("restricted");
  });
});
