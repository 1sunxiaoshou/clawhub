import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * 强制清理导致同步中断的别名冲突数据
 */
export const cleanupReservedSlug = internalMutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. 查找保留记录
    const reservation = await ctx.db
      .query("reservedSlugs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (reservation) {
      await ctx.db.delete(reservation._id);
      console.log(`[REPAIR] Deleted reservation for slug: ${args.slug}`);
    }

    // 2. 查找可能存在的软删除 Skill
    const existingSkill = await ctx.db
      .query("skills")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existingSkill) {
      // 如果不是由我们的 local 账号拥有的，直接硬删除它
      await ctx.db.delete(existingSkill._id);
      console.log(`[REPAIR] Hard deleted existing skill record for slug: ${args.slug}`);
    }

    return { ok: true, cleaned: args.slug };
  },
});
