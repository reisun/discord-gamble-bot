import { GambleBet, GambleLedger } from '../models/gamble';

type UserStake = {
    userId: string,
    amount: number,
}

export type PayoutSummary = {
    totalStake: number,
    winningBetCount: number,
    maxPayout: number,
    winnerPayoutByUserId: Map<string, number>,
    loserStakeByUserId: Map<string, number>,
    ledgerDrafts: Omit<GambleLedger, "createdAt">[],
}

const aggregateStakeByUser = (bets: GambleBet[]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const bet of bets) {
        map.set(bet.userId, (map.get(bet.userId) ?? 0) + bet.amount);
    }
    return map;
}

const allocatePayoutWithFixedRoundingRule = (
    totalStake: number,
    winningUserStakes: UserStake[],
): Map<string, number> => {
    const totalWinningStake = winningUserStakes.reduce((sum, w) => sum + w.amount, 0);
    const result = new Map<string, number>();
    if (totalWinningStake <= 0 || totalStake <= 0) {
        return result;
    }

    const allocations = winningUserStakes.map((winner) => {
        const raw = totalStake * winner.amount / totalWinningStake;
        const floored = Math.floor(raw);
        return {
            userId: winner.userId,
            floored,
            remainder: raw - floored,
        };
    });

    const flooredTotal = allocations.reduce((sum, a) => sum + a.floored, 0);
    let rest = totalStake - flooredTotal;

    allocations
        .sort((a, b) => {
            if (b.remainder !== a.remainder) {
                return b.remainder - a.remainder;
            }
            return a.userId.localeCompare(b.userId);
        })
        .forEach((a, index) => {
            const extra = rest > index ? 1 : 0;
            result.set(a.userId, a.floored + extra);
        });

    return result;
}

export const buildPayoutSummary = (
    sessionId: string,
    gameId: string,
    bets: GambleBet[],
    winningTicket: string,
): PayoutSummary => {
    const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);

    const winningBets = bets.filter((bet) => bet.ticket === winningTicket);
    const winningBetCount = winningBets.length;

    const winnerStakeByUserId = aggregateStakeByUser(winningBets);
    const winningUserStakes: UserStake[] = Array.from(winnerStakeByUserId.entries()).map(([userId, amount]) => ({
        userId,
        amount,
    }));
    const winnerPayoutByUserId = allocatePayoutWithFixedRoundingRule(totalStake, winningUserStakes);

    const allStakeByUserId = aggregateStakeByUser(bets);
    const loserStakeByUserId = new Map<string, number>();
    for (const [userId, amount] of allStakeByUserId.entries()) {
        if (!winnerPayoutByUserId.has(userId)) {
            loserStakeByUserId.set(userId, amount);
        }
    }

    const ledgerDrafts: Omit<GambleLedger, "createdAt">[] = [];
    for (const [userId, stake] of allStakeByUserId.entries()) {
        ledgerDrafts.push({
            sessionId,
            gameId,
            userId,
            delta: -stake,
            reason: "bet settlement",
            type: "stake_settlement",
            amount: -stake,
            // omit createdAt: new Date(),
            balanceAfter: 0, // 仮の値。実際の挿入時に計算される想定
            note: "bet settlement",
        });
    }
    for (const [userId, payout] of winnerPayoutByUserId.entries()) {
        ledgerDrafts.push({
            sessionId,
            gameId,
            userId,
            delta: payout,
            reason: "payout",
            type: "payout",
            amount: payout,
            // omit createdAt: new Date(),
            balanceAfter: 0, // 仮の値。実際の挿入時に計算される想定
            note: `winning ticket: ${winningTicket}`,
        });
    }

    const maxPayout = Math.max(0, ...winnerPayoutByUserId.values());
    return {
        totalStake,
        winningBetCount,
        maxPayout,
        winnerPayoutByUserId,
        loserStakeByUserId,
        ledgerDrafts,
    };
}
