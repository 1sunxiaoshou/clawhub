import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./functions";

const proxiesInternal = (
  internal as unknown as {
    proxies: {
      upsertProxiesInternal: unknown;
      cleanupInactiveProxiesInternal: unknown;
    };
  }
).proxies;

const PROXY_SOURCES = [
  "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
];

/**
 * 刷新代理池：从公开列表抓取并存入数据库
 */
export const refreshProxyPool = internalAction({
  args: {},
  handler: async (ctx) => {
    const allProxies: string[] = [];

    for (const source of PROXY_SOURCES) {
      try {
        const response = await fetch(source);
        if (response.ok) {
          const text = await response.text();
          const lines = text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#") && line.includes(":"))
            .filter((line) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(line));
          allProxies.push(...lines);
        }
      } catch (error) {
        console.error(`[Proxy] Failed to fetch from ${source}:`, error);
      }
    }

    const uniqueProxies = Array.from(new Set(allProxies));
    console.log(`[Proxy] Fetched ${uniqueProxies.length} unique proxies.`);

    // 批量存入数据库（分批以避免事务过大）
    const batchSize = 100;
    for (let i = 0; i < uniqueProxies.length; i += batchSize) {
      const batch = uniqueProxies.slice(i, i + batchSize);
      await ctx.runMutation(
        proxiesInternal.upsertProxiesInternal as never,
        { proxies: batch } as never,
      );
    }

    // 清理长期不工作的代理
    await ctx.runMutation(proxiesInternal.cleanupInactiveProxiesInternal as never, {} as never);
  },
});

export const upsertProxiesInternal = internalMutation({
  args: { proxies: v.array(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const address of args.proxies) {
      const existing = await ctx.db
        .query("publicProxies")
        .withIndex("by_address", (q) => q.eq("address", address))
        .unique();

      if (!existing) {
        await ctx.db.insert("publicProxies", {
          address,
          protocol: "http",
          status: "active",
          failCount: 0,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(existing._id, {
          updatedAt: now,
        });
      }
    }
  },
});

export const cleanupInactiveProxiesInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const inactive = await ctx.db
      .query("publicProxies")
      .withIndex("by_status_updated", (q) => q.eq("status", "failed").lt("updatedAt", weekAgo))
      .take(100);

    for (const proxy of inactive) {
      await ctx.db.delete(proxy._id);
    }
  },
});

export const getRandomProxyInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    // 选取最近活跃的代理列表中随机选取一个
    const activeProxies = await ctx.db
      .query("publicProxies")
      .withIndex("by_status_updated", (q) =>
        q.eq("status", "active").gt("updatedAt", Date.now() - 48 * 60 * 60 * 1000),
      )
      .order("desc")
      .take(50);

    if (activeProxies.length === 0) return null;
    return activeProxies[Math.floor(Math.random() * activeProxies.length)];
  },
});

export const reportProxyFailureInternal = internalMutation({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("publicProxies")
      .withIndex("by_address", (q) => q.eq("address", args.address))
      .unique();

    if (existing) {
      const failCount = existing.failCount + 1;
      await ctx.db.patch(existing._id, {
        failCount,
        status: failCount > 5 ? "failed" : "active",
        updatedAt: Date.now(),
      });
    }
  },
});
