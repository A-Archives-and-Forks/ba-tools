import { GAME_SERVERS } from "@/lib/types";
import { v } from "convex/values";
import {
  type RecruitmentPickup,
  applySessionToAggregates,
  calculateRecruitmentStats,
  emptyAccountAggregates,
  validateRecruitmentSession,
} from "../src/lib/recruitment";
import { internalMutation } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./lib/auth";

const pickupValidator = v.object({
  charge: v.number(),
  studentId: v.string(),
});

const sessionArgs = {
  name: v.string(),
  date: v.number(),
  kind: v.union(v.literal("permanent"), v.literal("limited")),
  isFestBanner: v.boolean(),
  startCharge: v.number(),
  totalPulls: v.number(),
  pickupsObtained: v.array(pickupValidator),
  threeStarCount: v.number(),
  rebateTicketsUsed: v.number(),
};

function statsFor(session: {
  startCharge: number;
  totalPulls: number;
  pickupsObtained: RecruitmentPickup[];
  threeStarCount: number;
  rebateTicketsFromPreviousSession: number;
  rebateTicketsUsed?: number;
  isFestBanner?: boolean;
}) {
  return calculateRecruitmentStats(session);
}

function computedStatsFor(session: Parameters<typeof statsFor>[0]) {
  const stats = statsFor(session);
  return {
    ...stats,
    pullsPerPU: stats.pullsPerPU ?? undefined,
    pullsPerThreeStar: stats.pullsPerThreeStar ?? undefined,
  };
}

function inputFor(session: any) {
  return {
    startCharge: session.startCharge,
    totalPulls: session.totalPulls,
    threeStarCount: session.threeStarCount,
    rebateTicketsFromPreviousSession: session.rebateTicketsFromPreviousSession,
    rebateTicketsUsed: session.rebateTicketsUsed,
    pickupsObtained: session.pickupsObtained,
  };
}

async function getLatestSession(
  ctx: { db: any },
  accountId: any,
  kind: "permanent" | "limited",
) {
  const account = await ctx.db.get(accountId);
  const latestId =
    kind === "permanent"
      ? account?.latestPermanentSessionId
      : account?.latestLimitedSessionId;
  if (latestId) return await ctx.db.get(latestId);
  return (
    await ctx.db
      .query("recruitmentSession")
      .withIndex("by_recruitmentAccountId_date", (q: any) =>
        q.eq("recruitmentAccountId", accountId),
      )
      .order("desc")
      .collect()
  ).find((session: any) => session.kind === kind);
}

async function assertAccount(
  ctx: { db: any; user: { _id: any } },
  accountId: any,
) {
  const account = await ctx.db.get(accountId);
  if (!account || account.userId !== ctx.user._id) {
    throw new Error("Recruitment account not found.");
  }
  return account;
}

async function assertSession(
  ctx: { db: any; user: { _id: any } },
  sessionId: any,
) {
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== ctx.user._id) {
    throw new Error("Recruitment session not found.");
  }
  return session;
}

async function rebuildAccountAnalytics(
  ctx: { db: any },
  account: any,
  preserveStartChargeFor?: any,
) {
  const sessions = (
    await ctx.db
      .query("recruitmentSession")
      .withIndex("by_recruitmentAccountId_date", (q: any) =>
        q.eq("recruitmentAccountId", account._id),
      )
      .order("asc")
      .collect()
  ).sort(
    (a: any, b: any) => a.date - b.date || a._creationTime - b._creationTime,
  );

  let aggregates = emptyAccountAggregates();
  const previousByKind: Record<
    "permanent" | "limited",
    { endCharge: number; remainingRebateTickets: number } | undefined
  > = {
    permanent: undefined,
    limited: undefined,
  };
  const latest: Record<"permanent" | "limited", any> = {
    permanent: undefined,
    limited: undefined,
  };

  for (const session of sessions) {
    const kind = session.kind as "permanent" | "limited";
    const previous = previousByKind[kind];
    const startCharge =
      previous && session._id !== preserveStartChargeFor
        ? previous.endCharge
        : session.startCharge;
    const rebateTicketsFromPreviousSession = previous
      ? previous.remainingRebateTickets
      : session.rebateTicketsFromPreviousSession;
    const input = {
      ...inputFor(session),
      startCharge,
      rebateTicketsFromPreviousSession,
    };
    const stats = statsFor({
      ...input,
      isFestBanner: session.isFestBanner ?? false,
    });
    const computedStats = computedStatsFor({
      ...input,
      isFestBanner: session.isFestBanner ?? false,
    });

    if (
      session.startCharge !== startCharge ||
      session.rebateTicketsFromPreviousSession !==
        rebateTicketsFromPreviousSession ||
      JSON.stringify(session.computedStats) !== JSON.stringify(computedStats)
    ) {
      await ctx.db.patch(session._id, {
        startCharge,
        rebateTicketsFromPreviousSession,
        computedStats,
      });
    }

    aggregates = applySessionToAggregates(
      aggregates,
      kind,
      session.isFestBanner ?? false,
      input,
      stats,
      1,
    );
    previousByKind[kind] = {
      endCharge: stats.endCharge,
      remainingRebateTickets: stats.remainingRebateTickets,
    };
    latest[kind] = session;
  }

  await ctx.db.patch(account._id, {
    aggregates,
    latestPermanentSessionId: latest.permanent?._id,
    latestLimitedSessionId: latest.limited?._id,
    permanentCharge: previousByKind.permanent?.endCharge ?? 0,
    limitedCharge: previousByKind.limited?.endCharge ?? 0,
  });
}

export const getOwnAccounts = authenticatedQuery({
  handler: async (ctx) => {
    return await ctx.db
      .query("recruitmentAccount")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .collect();
  },
});

export const getAccount = authenticatedQuery({
  args: { accountId: v.id("recruitmentAccount") },
  handler: async (ctx, { accountId }) => {
    const account = await assertAccount(ctx, accountId);
    const sessions = await ctx.db
      .query("recruitmentSession")
      .withIndex("by_recruitmentAccountId_date", (q) =>
        q.eq("recruitmentAccountId", accountId),
      )
      .order("desc")
      .collect();

    return {
      account,
      sessions: sessions
        .sort((a, b) => b.date - a.date || b._creationTime - a._creationTime)
        .map((session) => ({
          ...session,
          stats: session.computedStats ?? computedStatsFor(session),
          isLatest:
            session._id ===
            sessions
              .filter((item) => item.kind === session.kind)
              .sort(
                (a, b) => b.date - a.date || b._creationTime - a._creationTime,
              )[0]?._id,
        })),
    };
  },
});

export const getSession = authenticatedQuery({
  args: { sessionId: v.id("recruitmentSession") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== ctx.user._id) {
      throw new Error("Recruitment session not found.");
    }
    const latest = await getLatestSession(
      ctx,
      session.recruitmentAccountId,
      session.kind,
    );
    return {
      ...session,
      stats: session.computedStats ?? computedStatsFor(session),
      isLatest: latest?._id === session._id,
    };
  },
});

export const createAccount = authenticatedMutation({
  args: {
    name: v.string(),
    gameServer: v.union(...GAME_SERVERS.map((server) => v.literal(server))),
    permanentCharge: v.number(),
    limitedCharge: v.number(),
  },
  handler: async (
    ctx,
    { name, gameServer, permanentCharge, limitedCharge },
  ) => {
    if (
      !Number.isInteger(permanentCharge) ||
      permanentCharge < 0 ||
      permanentCharge > 200 ||
      !Number.isInteger(limitedCharge) ||
      limitedCharge < 0 ||
      limitedCharge > 200
    ) {
      throw new Error("Charge must be an integer from 0 to 200.");
    }
    return ctx.db.insert("recruitmentAccount", {
      userId: ctx.user._id,
      name,
      gameServer,
      permanentCharge,
      limitedCharge,
      aggregates: emptyAccountAggregates(),
    });
  },
});

export const updateAccount = authenticatedMutation({
  args: {
    accountId: v.id("recruitmentAccount"),
    name: v.string(),
    gameServer: v.union(...GAME_SERVERS.map((server) => v.literal(server))),
    permanentCharge: v.number(),
    limitedCharge: v.number(),
  },
  handler: async (
    ctx,
    { accountId, name, gameServer, permanentCharge, limitedCharge },
  ) => {
    await assertAccount(ctx, accountId);
    if (
      !Number.isInteger(permanentCharge) ||
      permanentCharge < 0 ||
      permanentCharge > 200 ||
      !Number.isInteger(limitedCharge) ||
      limitedCharge < 0 ||
      limitedCharge > 200
    ) {
      throw new Error("Charge must be an integer from 0 to 200.");
    }
    await ctx.db.patch(accountId, {
      name,
      gameServer,
      permanentCharge,
      limitedCharge,
    });
  },
});

export const createSession = authenticatedMutation({
  args: {
    recruitmentAccountId: v.id("recruitmentAccount"),
    ...sessionArgs,
  },
  handler: async (ctx, args) => {
    const account = await assertAccount(ctx, args.recruitmentAccountId);
    const previous = await getLatestSession(
      ctx,
      args.recruitmentAccountId,
      args.kind,
    );
    const rebateTicketsFromPreviousSession = previous
      ? statsFor(previous).remainingRebateTickets
      : 0;
    const session = {
      userId: ctx.user._id,
      recruitmentAccountId: args.recruitmentAccountId,
      name: args.name,
      date: args.date,
      kind: args.kind,
      isFestBanner: args.isFestBanner,
      rebateTicketsFromPreviousSession,
      startCharge: args.startCharge,
      totalPulls: args.totalPulls,
      pickupsObtained: args.pickupsObtained,
      threeStarCount: args.threeStarCount,
      rebateTicketsUsed: args.rebateTicketsUsed,
    };
    validateRecruitmentSession(session);
    const computedStats = computedStatsFor(session);
    const sessionId = await ctx.db.insert("recruitmentSession", {
      ...session,
      computedStats,
    });
    await rebuildAccountAnalytics(ctx, account, sessionId);
    return sessionId;
  },
});

export const updateSession = authenticatedMutation({
  args: {
    sessionId: v.id("recruitmentSession"),
    ...sessionArgs,
  },
  handler: async (ctx, args) => {
    const session = await assertSession(ctx, args.sessionId);
    if (args.kind !== session.kind) {
      throw new Error("A session's banner type cannot be changed.");
    }
    const updated = {
      ...session,
      name: args.name,
      date: args.date,
      isFestBanner: args.isFestBanner,
      startCharge: args.startCharge,
      totalPulls: args.totalPulls,
      pickupsObtained: args.pickupsObtained,
      threeStarCount: args.threeStarCount,
      rebateTicketsUsed: args.rebateTicketsUsed,
    };
    validateRecruitmentSession(updated);
    const computedStats = computedStatsFor(updated);
    await ctx.db.patch(args.sessionId, {
      name: args.name,
      date: args.date,
      isFestBanner: args.isFestBanner,
      startCharge: args.startCharge,
      totalPulls: args.totalPulls,
      pickupsObtained: args.pickupsObtained,
      threeStarCount: args.threeStarCount,
      rebateTicketsUsed: args.rebateTicketsUsed,
      computedStats,
    });
    const account = await assertAccount(ctx, session.recruitmentAccountId);
    await rebuildAccountAnalytics(ctx, account, session._id);
  },
});

export const deleteSession = authenticatedMutation({
  args: { sessionId: v.id("recruitmentSession") },
  handler: async (ctx, { sessionId }) => {
    const session = await assertSession(ctx, sessionId);
    const account = await assertAccount(ctx, session.recruitmentAccountId);
    await ctx.db.delete(sessionId);
    await rebuildAccountAnalytics(ctx, account);
  },
});

export const deleteAccount = authenticatedMutation({
  args: { accountId: v.id("recruitmentAccount") },
  handler: async (ctx, { accountId }) => {
    await assertAccount(ctx, accountId);
    const sessions = await ctx.db
      .query("recruitmentSession")
      .withIndex("by_recruitmentAccountId", (q) =>
        q.eq("recruitmentAccountId", accountId),
      )
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await ctx.db.delete(accountId);
  },
});

export const backfillRecruitmentAnalytics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("recruitmentAccount").collect();
    for (const account of accounts) {
      const sessions = await ctx.db
        .query("recruitmentSession")
        .withIndex("by_recruitmentAccountId", (q) =>
          q.eq("recruitmentAccountId", account._id),
        )
        .collect();
      let aggregates = emptyAccountAggregates();
      let latestPermanent: (typeof sessions)[number] | undefined;
      let latestLimited: (typeof sessions)[number] | undefined;

      for (const session of sessions) {
        const computedStats = computedStatsFor(session);
        const stats = statsFor(inputFor(session));
        aggregates = applySessionToAggregates(
          aggregates,
          session.kind,
          session.isFestBanner ?? false,
          inputFor(session),
          stats,
          1,
        );
        await ctx.db.patch(session._id, {
          isFestBanner: session.isFestBanner ?? false,
          computedStats,
        });
        const latest =
          session.kind === "permanent" ? latestPermanent : latestLimited;
        if (
          !latest ||
          session.date > latest.date ||
          (session.date === latest.date &&
            session._creationTime > latest._creationTime)
        ) {
          if (session.kind === "permanent") latestPermanent = session;
          else latestLimited = session;
        }
      }

      await ctx.db.patch(account._id, {
        aggregates,
        latestPermanentSessionId: latestPermanent?._id,
        latestLimitedSessionId: latestLimited?._id,
        permanentCharge: latestPermanent
          ? computedStatsFor(latestPermanent).endCharge
          : account.permanentCharge,
        limitedCharge: latestLimited
          ? computedStatsFor(latestLimited).endCharge
          : account.limitedCharge,
      });
    }
  },
});
