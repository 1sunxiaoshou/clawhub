import { describe, expect, it } from "vitest";
import { __test } from "./clawhubSync";

describe("clawhub sync mirror helpers", () => {
  it("keeps only tags that point to the upstream latest version", () => {
    expect(
      __test.pickMirroredLatestTagNames(
        {
          latest: "1.2.3",
          stable: "1.2.3",
          beta: "1.2.4-beta.1",
        },
        "1.2.3",
      ),
    ).toEqual(["latest", "stable"]);
  });

  it("always preserves latest when upstream tags are missing", () => {
    expect(__test.pickMirroredLatestTagNames(undefined, "1.2.3")).toEqual(["latest"]);
  });

  it("normalizes upstream moderation payload", () => {
    expect(
      __test.normalizeClawhubModeration({
        isSuspicious: true,
        isMalwareBlocked: false,
        verdict: "suspicious",
        reasonCodes: [" suspicious.dynamic_code_execution ", ""],
        summary: "Flagged",
        engineVersion: "v2.0.0",
        updatedAt: 1234.9,
      }),
    ).toEqual({
      isSuspicious: true,
      isMalwareBlocked: false,
      verdict: "suspicious",
      reasonCodes: ["suspicious.dynamic_code_execution"],
      summary: "Flagged",
      engineVersion: "v2.0.0",
      updatedAt: 1234,
    });
  });
});
