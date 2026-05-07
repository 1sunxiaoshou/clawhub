import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  canDownloadSkill,
  canListSkillPublicly,
  canManageSkillAccess,
  canReadSkillFile,
  canReadSkillForActor,
  canSeeModerationEvidence,
  getSkillVisibility,
  type SkillPolicyActor,
} from "./skillPolicy";

type Row = Record<string, unknown>;
type TestSkill = Pick<
  Doc<"skills">,
  | "_id"
  | "ownerUserId"
  | "ownerPublisherId"
  | "visibility"
  | "softDeletedAt"
  | "moderationStatus"
  | "moderationReason"
  | "moderationFlags"
>;

function makeCtx(rows: Record<string, Row[]> = {}) {
  return {
    db: {
      query(table: string) {
        let filters: Array<[string, unknown]> = [];
        return {
          withIndex(
            _index: string,
            build: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
          ) {
            const q = {
              eq(field: string, value: unknown) {
                filters.push([field, value]);
                return q;
              },
            };
            build(q);
            return this;
          },
          async unique() {
            return (rows[table] ?? []).find((row) =>
              filters.every(([field, value]) => row[field] === value),
            );
          },
          async collect() {
            return (rows[table] ?? []).filter((row) =>
              filters.every(([field, value]) => row[field] === value),
            );
          },
        };
      },
    },
  } as never;
}

function makeActor(overrides: Partial<SkillPolicyActor> = {}): SkillPolicyActor {
  return {
    _id: "users:actor" as Id<"users">,
    role: "user",
    deletedAt: undefined,
    deactivatedAt: undefined,
    ...overrides,
  };
}

function makeSkill(overrides: Partial<TestSkill> = {}): TestSkill {
  return {
    _id: "skills:demo" as Id<"skills">,
    ownerUserId: "users:owner" as Id<"users">,
    ownerPublisherId: undefined,
    visibility: "public",
    softDeletedAt: undefined,
    moderationStatus: "active",
    moderationReason: undefined,
    moderationFlags: undefined,
    ...overrides,
  };
}

describe("skill policy visibility", () => {
  it("defaults legacy skills to public visibility", () => {
    expect(getSkillVisibility({ visibility: undefined } as never)).toBe("public");
  });

  it("lists only public, active, non-malware skills publicly", () => {
    expect(canListSkillPublicly(makeSkill())).toBe(true);
    expect(canListSkillPublicly(makeSkill({ visibility: "restricted" }))).toBe(false);
    expect(canListSkillPublicly(makeSkill({ visibility: "private" }))).toBe(false);
    expect(canListSkillPublicly(makeSkill({ softDeletedAt: 1 }))).toBe(false);
    expect(canListSkillPublicly(makeSkill({ moderationStatus: "hidden" }))).toBe(false);
    expect(canListSkillPublicly(makeSkill({ moderationFlags: ["blocked.malware"] }))).toBe(false);
  });
});

describe("skill read policy", () => {
  it("allows anonymous reads for public active skills only", async () => {
    expect(await canReadSkillForActor(makeCtx(), makeSkill() as never, null)).toBe(true);
    expect(
      await canReadSkillForActor(makeCtx(), makeSkill({ visibility: "restricted" }) as never, null),
    ).toBe(false);
    expect(
      await canReadSkillForActor(makeCtx(), makeSkill({ visibility: "private" }) as never, null),
    ).toBe(false);
  });

  it("allows owners, publisher members, and staff regardless of visibility", async () => {
    expect(
      await canReadSkillForActor(
        makeCtx(),
        makeSkill({ visibility: "private" }) as never,
        makeActor({ _id: "users:owner" as Id<"users"> }),
      ),
    ).toBe(true);

    expect(
      await canReadSkillForActor(
        makeCtx({
          publisherMembers: [
            {
              publisherId: "publishers:team",
              userId: "users:actor",
              role: "publisher",
            },
          ],
        }),
        makeSkill({
          ownerPublisherId: "publishers:team" as Id<"publishers">,
          visibility: "private",
        }) as never,
        makeActor(),
      ),
    ).toBe(true);

    expect(
      await canReadSkillForActor(
        makeCtx(),
        makeSkill({ visibility: "private", moderationStatus: "hidden" }) as never,
        makeActor({ role: "moderator" }),
      ),
    ).toBe(true);
  });

  it("allows restricted skills through direct and publisher grants", async () => {
    expect(
      await canReadSkillForActor(
        makeCtx({
          skillAccessGrants: [
            {
              skillId: "skills:demo",
              subjectUserId: "users:actor",
            },
          ],
        }),
        makeSkill({ visibility: "restricted" }) as never,
        makeActor(),
      ),
    ).toBe(true);

    expect(
      await canReadSkillForActor(
        makeCtx({
          publisherMembers: [{ publisherId: "publishers:team", userId: "users:actor" }],
          skillAccessGrants: [
            {
              skillId: "skills:demo",
              subjectPublisherId: "publishers:team",
            },
          ],
        }),
        makeSkill({ visibility: "restricted" }) as never,
        makeActor(),
      ),
    ).toBe(true);
  });

  it("does not apply grants to private skills", async () => {
    expect(
      await canReadSkillForActor(
        makeCtx({
          skillAccessGrants: [
            {
              skillId: "skills:demo",
              subjectUserId: "users:actor",
            },
          ],
        }),
        makeSkill({ visibility: "private" }) as never,
        makeActor(),
      ),
    ).toBe(false);
  });

  it("allows file reads for malware-blocked versions but blocks downloads", async () => {
    const skill = makeSkill({ moderationFlags: ["blocked.malware"] }) as never;
    expect(
      await canReadSkillFile(makeCtx(), skill, { softDeletedAt: undefined } as never, null),
    ).toBe(true);
    expect(canDownloadSkill(skill).allowed).toBe(false);
    expect(canDownloadSkill(skill).status).toBe(403);
  });

  it("returns download-specific denials for moderated skills", () => {
    expect(
      canDownloadSkill(makeSkill({ moderationStatus: "hidden", moderationReason: "pending.scan" }))
        .status,
    ).toBe(423);
    expect(canDownloadSkill(makeSkill({ moderationStatus: "hidden" })).status).toBe(403);
    expect(canDownloadSkill(makeSkill({ moderationStatus: "removed" })).status).toBe(410);
  });
});

describe("skill management policy", () => {
  it("allows only owner, publisher admin/owner, and staff to manage access", async () => {
    expect(
      await canManageSkillAccess(
        makeCtx(),
        makeSkill() as never,
        makeActor({ _id: "users:owner" as Id<"users"> }),
      ),
    ).toBe(true);
    expect(await canManageSkillAccess(makeCtx(), makeSkill() as never, makeActor())).toBe(false);
    expect(
      await canManageSkillAccess(makeCtx(), makeSkill() as never, makeActor({ role: "admin" })),
    ).toBe(true);
    expect(
      await canManageSkillAccess(
        makeCtx({
          publisherMembers: [
            {
              publisherId: "publishers:team",
              userId: "users:actor",
              role: "admin",
            },
          ],
        }),
        makeSkill({ ownerPublisherId: "publishers:team" as Id<"publishers"> }) as never,
        makeActor(),
      ),
    ).toBe(true);
  });

  it("limits raw moderation evidence to direct owners and staff for now", () => {
    expect(
      canSeeModerationEvidence(
        makeSkill() as never,
        makeActor({ _id: "users:owner" as Id<"users"> }),
      ),
    ).toBe(true);
    expect(canSeeModerationEvidence(makeSkill() as never, makeActor())).toBe(false);
    expect(canSeeModerationEvidence(makeSkill() as never, makeActor({ role: "moderator" }))).toBe(
      true,
    );
  });
});
