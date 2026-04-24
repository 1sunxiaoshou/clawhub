import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { requireApiTokenUser } from "../lib/apiTokenAuth";
import { applyRateLimit } from "../lib/httpRateLimit";
import { json, text } from "./shared";

export async function whoamiV1Handler(ctx: ActionCtx, request: Request) {
  const rate = await applyRateLimit(ctx, request, "read");
  if (!rate.ok) return rate.response;

  try {
    const { user, userId } = await requireApiTokenUser(ctx, request);
    const publishers = await ctx.runQuery(internal.publishers.listForUserInternal, { userId });
    return json(
      {
        user: {
          id: user._id,
          handle: user.handle ?? null,
          role: user.role ?? "user",
          displayName: user.displayName ?? null,
          image: user.image ?? null,
        },
        publishers: (publishers as Array<{
          publisher: {
            _id: string;
            handle?: string;
            displayName?: string;
            image?: string;
            kind: "user" | "org";
          };
          role: string;
        }>).map((entry) => ({
          id: entry.publisher._id,
          handle: entry.publisher.handle ?? null,
          displayName: entry.publisher.displayName ?? null,
          image: entry.publisher.image ?? null,
          kind: entry.publisher.kind,
          role: entry.role,
        })),
      },
      200,
      rate.headers,
    );
  } catch {
    return text("Unauthorized", 401, rate.headers);
  }
}
