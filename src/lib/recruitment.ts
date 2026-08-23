export const REBATE_MILESTONES = [
  70, 130, 150, 170, 270, 330, 350, 370,
] as const;
export const SOFT_PITY = 100;
export const HARD_PITY = 200;
export const PYROXENE_COST = 120;
export const RECRUITMENT_COLORS = {
  base: {
    accent: "#0ebaf2",
    trackAccent: "#63e3ff",
    labelBorderActive: "#36cdff",
    labelTextActive: "#2b8bb5",
  },
  limited: {
    accent: "#fc54da",
    trackAccent: "#ff8ae5",
    labelBorderActive: "#ff8ae5",
    labelTextActive: "#c14098",
  },
  track: "#d4d4d4",
  labelBorder: "#a8a9ab",
  labelText: "#858585",
} as const;

export type RecruitmentKind = "permanent" | "limited";

export type RecruitmentPickup = {
  charge: number;
  studentId: string;
};

export type PickupClassification =
  | "beforeSoftPity"
  | "softWin"
  | "afterSoftPity"
  | "hardPity";

export type ComputedPickup = RecruitmentPickup & {
  classification: PickupClassification;
};

export type RecruitmentSessionInput = {
  startCharge: number;
  totalPulls: number;
  threeStarCount: number;
  rebateTicketsFromPreviousSession: number;
  rebateTicketsUsed?: number;
  isFestBanner?: boolean;
  pickupsObtained: RecruitmentPickup[];
};

export type RecruitmentStats = {
  endCharge: number;
  pickupCount: number;
  softPityWins: number;
  softPityLosses: number;
  hardPities: number;
  earnedRebateTickets: number;
  rebateTicketsUsed: number;
  remainingRebateTickets: number;
  paidPulls: number;
  experiencedThreeStarRate: number;
  experiencedPURate: number;
  pullsPerPU: number | null;
  pullsPerThreeStar: number | null;
  rebatePulls: number;
  pyroxenesSpent: number;
  pyroxenesSaved: number;
  pickupClassifications: ComputedPickup[];
};

export function numberOfRebateTickets(totalPulls: number): number {
  return REBATE_MILESTONES.filter((milestone) => milestone + 10 <= totalPulls)
    .length;
}

export function calculateRecruitmentStats(
  input: RecruitmentSessionInput,
): RecruitmentStats {
  validateRecruitmentSession(input);

  let consumedPulls = 0;
  let softPityWins = 0;
  let softPityLosses = 0;
  let hardPities = 0;

  for (const [index, pickup] of input.pickupsObtained.entries()) {
    const cycleStart = index === 0 ? input.startCharge : 0;
    const cyclePulls = pickup.charge - cycleStart;
    consumedPulls += cyclePulls;

    if (pickup.charge === SOFT_PITY) {
      softPityWins += 1;
    } else if (pickup.charge > SOFT_PITY) {
      softPityLosses += 1;
    }

    if (pickup.charge === HARD_PITY) {
      hardPities += 1;
    }
  }

  const finalCyclePulls = input.totalPulls - consumedPulls;

  const earnedRebateTickets = REBATE_MILESTONES.filter(
    (milestone) => milestone <= input.totalPulls,
  ).length;
  const usableEarnedTickets = numberOfRebateTickets(input.totalPulls);
  const availableTickets =
    input.rebateTicketsFromPreviousSession + usableEarnedTickets;
  const automaticallyUsedTickets = Math.min(
    availableTickets,
    Math.floor(input.totalPulls / 10),
  );
  const rebateTicketsUsed = input.rebateTicketsUsed ?? automaticallyUsedTickets;
  if (
    !Number.isInteger(rebateTicketsUsed) ||
    rebateTicketsUsed < 0 ||
    rebateTicketsUsed > automaticallyUsedTickets
  ) {
    throw new Error(
      `Rebate tickets used must be between 0 and ${automaticallyUsedTickets}.`,
    );
  }

  const pickupClassifications = input.pickupsObtained.map((pickup) => ({
    ...pickup,
    classification: classifyPickup(pickup.charge),
  }));

  return {
    endCharge: Math.min(
      HARD_PITY,
      input.pickupsObtained.length > 0
        ? finalCyclePulls
        : input.startCharge + finalCyclePulls,
    ),
    pickupCount: input.pickupsObtained.length,
    softPityWins,
    softPityLosses,
    hardPities,
    earnedRebateTickets,
    rebateTicketsUsed,
    remainingRebateTickets:
      input.rebateTicketsFromPreviousSession +
      earnedRebateTickets -
      rebateTicketsUsed,
    paidPulls: input.totalPulls - rebateTicketsUsed * 10,
    experiencedThreeStarRate:
      input.totalPulls === 0
        ? 0
        : (input.threeStarCount / input.totalPulls) * 100,
    experiencedPURate:
      input.totalPulls === 0
        ? 0
        : (input.pickupsObtained.length / input.totalPulls) * 100,
    pullsPerPU:
      input.pickupsObtained.length === 0
        ? null
        : input.totalPulls / input.pickupsObtained.length,
    pullsPerThreeStar:
      input.threeStarCount === 0
        ? null
        : input.totalPulls / input.threeStarCount,
    rebatePulls: rebateTicketsUsed * 10,
    pyroxenesSpent: (input.totalPulls - rebateTicketsUsed * 10) * PYROXENE_COST,
    pyroxenesSaved: rebateTicketsUsed * 10 * PYROXENE_COST,
    pickupClassifications,
  };
}

export function classifyPickup(charge: number): PickupClassification {
  if (charge === HARD_PITY) return "hardPity";
  if (charge === SOFT_PITY) return "softWin";
  if (charge > SOFT_PITY) return "afterSoftPity";
  return "beforeSoftPity";
}

export type AggregateBucket = {
  sessionCount: number;
  totalPulls: number;
  paidPulls: number;
  totalThreeStars: number;
  totalPickups: number;
  rebatePulls: number;
  pyroxenesSaved: number;
  softPityWins: number;
  softPityLosses: number;
  hardPities: number;
  naturalPickups: number;
  softWinPickups: number;
  softLossPickups: number;
  hardPityPickups: number;
  pickupChargeHistogram: number[];
};

export type AccountAggregates = {
  permanent: AggregateBucket;
  limited: AggregateBucket;
  fest: AggregateBucket;
};

export function emptyAggregateBucket(): AggregateBucket {
  return {
    sessionCount: 0,
    totalPulls: 0,
    paidPulls: 0,
    totalThreeStars: 0,
    totalPickups: 0,
    rebatePulls: 0,
    pyroxenesSaved: 0,
    softPityWins: 0,
    softPityLosses: 0,
    hardPities: 0,
    naturalPickups: 0,
    softWinPickups: 0,
    softLossPickups: 0,
    hardPityPickups: 0,
    pickupChargeHistogram: Array.from({ length: HARD_PITY + 1 }, () => 0),
  };
}

export function emptyAccountAggregates(): AccountAggregates {
  return {
    permanent: emptyAggregateBucket(),
    limited: emptyAggregateBucket(),
    fest: emptyAggregateBucket(),
  };
}

export function getAggregateBucket(
  kind: RecruitmentKind,
  isFestBanner = false,
): keyof AccountAggregates {
  if (isFestBanner) return "fest";
  return kind;
}

export function applySessionToAggregates(
  aggregates: AccountAggregates,
  kind: RecruitmentKind,
  isFestBanner: boolean,
  input: RecruitmentSessionInput,
  stats: RecruitmentStats,
  direction: 1 | -1,
): AccountAggregates {
  const result: AccountAggregates = {
    permanent: {
      ...aggregates.permanent,
      pickupChargeHistogram: [...aggregates.permanent.pickupChargeHistogram],
    },
    limited: {
      ...aggregates.limited,
      pickupChargeHistogram: [...aggregates.limited.pickupChargeHistogram],
    },
    fest: {
      ...aggregates.fest,
      pickupChargeHistogram: [...aggregates.fest.pickupChargeHistogram],
    },
  };
  const bucket = result[getAggregateBucket(kind, isFestBanner)];
  const factor = direction;

  bucket.sessionCount += factor;
  bucket.totalPulls += factor * input.totalPulls;
  bucket.paidPulls += factor * stats.paidPulls;
  bucket.totalThreeStars += factor * input.threeStarCount;
  bucket.totalPickups += factor * stats.pickupCount;
  bucket.rebatePulls += factor * stats.rebatePulls;
  bucket.pyroxenesSaved += factor * stats.pyroxenesSaved;
  bucket.softPityWins += factor * stats.softPityWins;
  bucket.softPityLosses += factor * stats.softPityLosses;
  bucket.hardPities += factor * stats.hardPities;

  for (const pickup of stats.pickupClassifications) {
    bucket.pickupChargeHistogram[pickup.charge] += factor;
    if (pickup.classification === "beforeSoftPity") {
      bucket.naturalPickups += factor;
    }
    if (pickup.classification === "softWin") bucket.softWinPickups += factor;
    if (pickup.classification === "afterSoftPity") {
      bucket.softLossPickups += factor;
    }
    if (pickup.classification === "hardPity") bucket.hardPityPickups += factor;
  }

  return result;
}

export function validateRecruitmentSession(
  input: RecruitmentSessionInput,
): void {
  if (
    !Number.isInteger(input.startCharge) ||
    input.startCharge < 0 ||
    input.startCharge > HARD_PITY
  ) {
    throw new Error("Start charge must be an integer from 0 to 200.");
  }
  if (!Number.isInteger(input.totalPulls) || input.totalPulls < 0) {
    throw new Error("Total pulls must be a non-negative integer.");
  }
  if (!Number.isInteger(input.threeStarCount) || input.threeStarCount < 0) {
    throw new Error("3★ count must be a non-negative integer.");
  }
  if (
    !Number.isInteger(input.rebateTicketsFromPreviousSession) ||
    input.rebateTicketsFromPreviousSession < 0
  ) {
    throw new Error("Previous rebate tickets must be a non-negative integer.");
  }
  if (
    input.rebateTicketsUsed !== undefined &&
    (!Number.isInteger(input.rebateTicketsUsed) || input.rebateTicketsUsed < 0)
  ) {
    throw new Error("Rebate tickets used must be a non-negative integer.");
  }
  if (input.threeStarCount < input.pickupsObtained.length) {
    throw new Error("3★ count cannot be lower than the number of pickups.");
  }

  let consumedPulls = 0;
  for (const [index, pickup] of input.pickupsObtained.entries()) {
    if (
      !Number.isInteger(pickup.charge) ||
      pickup.charge < 1 ||
      pickup.charge > HARD_PITY ||
      pickup.studentId.length === 0
    ) {
      throw new Error("Each pickup must have a valid student and charge.");
    }
    const cycleStart = index === 0 ? input.startCharge : 0;
    const cyclePulls = pickup.charge - cycleStart;
    if (cyclePulls < 1) {
      throw new Error("Pickup charges must be in pull order.");
    }
    consumedPulls += cyclePulls;
  }

  if (consumedPulls > input.totalPulls) {
    throw new Error(
      "Pickup charges require more pulls than this session contains.",
    );
  }
}
