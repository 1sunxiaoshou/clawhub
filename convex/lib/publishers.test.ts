import { describe, expect, it, vi } from "vitest";
import { ensurePersonalPublisherForUser } from "./publishers";

describe("ensurePersonalPublisherForUser", () => {
  it("does not patch an existing personal publisher when nothing changed", async () => {
    const publisher = {
      _id: "publishers:alice",
      _creationTime: 1,
      kind: "user",
      handle: "alice",
      displayName: "Alice",
      bio: "bio",
      image: "https://example.com/alice.png",
      linkedUserId: "users:alice",
      trustedPublisher: false,
      deletedAt: undefined,
      deactivatedAt: undefined,
      createdAt: 1,
      updatedAt: 1,
    };
    const user = {
      _id: "users:alice",
      _creationTime: 1,
      handle: "alice",
      name: "alice",
      displayName: "Alice",
      bio: "bio",
      image: "https://example.com/alice.png",
      trustedPublisher: false,
      personalPublisherId: "publishers:alice",
      createdAt: 1,
      updatedAt: 1,
    };
    const patch = vi.fn();
    const insert = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "publishers:alice") return publisher;
          return null;
        }),
        patch,
        insert,
        query: vi.fn((table: string) => {
          if (table === "publishers") {
            return {
              withIndex: vi.fn(() => ({
                unique: vi.fn().mockResolvedValue(publisher),
              })),
            };
          }
          if (table === "publisherMembers") {
            return {
              withIndex: vi.fn(() => ({
                unique: vi.fn().mockResolvedValue({
                  _id: "publisherMembers:alice",
                  publisherId: "publishers:alice",
                  userId: "users:alice",
                  role: "owner",
                }),
              })),
            };
          }
          throw new Error(`unexpected table ${table}`);
        }),
      },
    };

    const result = await ensurePersonalPublisherForUser(ctx as never, user as never);

    expect(result).toEqual(publisher);
    expect(patch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
