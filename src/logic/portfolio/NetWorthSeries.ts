import { isCashAccountType, indexInstitutions } from 'src/logic/accounts/Accounts';
import { categoryIdsWithRole } from 'src/logic/categories/Categories';
import { lastDayOfMonth } from 'src/logic/checks/CheckDates';
import { positionKey, valueHolding, walkPositions, type PositionWalk } from 'src/logic/investments/Holdings';
import { indexPriceHistories, indexSecurities, priceOnOrBefore } from 'src/logic/investments/Securities';
import type { WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, multiplyWorkingScaleByQuantityScale, widenToWorkingScale } from 'src/logic/money/Money';
import { isPensionFund, netPensionFund } from 'src/logic/portfolio/NetWorth';
import type { IsoDate, LedgerDocument, LedgerId } from 'src/types/LedgerTypes';

/**
 * Net worth over time: the same quantity as the headline, computed at each month end from the start of the file instead of only
 * at today's.
 *
 * **The final point is the headline figure, to the cent.** A transaction, a trade and a price are each a record of something
 * that has happened and none of them may be dated ahead ([§13]), so at today every account is open, every transaction is
 * counted, every position is whole and every security that has any price has one dated on or before the point being drawn —
 * which is precisely the set [§11.4] sums over.
 *
 * **The three rates and the fee applied at every point are today's** — a security's `taxRate`, a pension fund's `exitTaxRate`
 * and an institution's `defaultSellFee` — because they are the only ones the file records. A past point is therefore what that
 * portfolio would have been worth in hand *on today's terms*, not what it would have fetched at the time.
 *
 * **Two holdings fall back to cost, and they fall back to the same figure.** One whose security has at least one price but none
 * dated early enough, and one whose security has **no price at all**, each contribute their cost, with no sell fee and no tax, and
 * the point says so either way. The second never stops applying, so a file holding one unpriced security draws its whole life from
 * cost — **today's point included, which is the one case the final point is drawn from cost**. The last point still equals the
 * headline to the cent, because the headline carries that holding at cost too, and **that is why the two agree**: not because
 * nothing falls back to cost at today, but because both sides fall back to the same thing.
 *
 * **There is one cost state and not two.** Which of the two cases a point is in is check 3's to say and not the line's: both are
 * answered by recording a price, and a second state would need a precedence rule for the month that is in both at once.
 *
 * **A position that has ever gone oversold contributes nothing at any point**, the early ones included: no holding is derived for
 * it at all, so the line is wrong by whatever it was worth in the years before the trade that broke it, and checks 8 and 9 are
 * failing while that is true.
 */

export interface NetWorthPoint {
	date: IsoDate;

	// Net worth at that date, at the working scale
	value: WorkingAmount;

	// Whether any holding open at this point had to be carried at its cost, which is what draws the point dashed
	fromCost: boolean;
}

export interface NetWorthSeriesOptions {
	document: LedgerDocument;

	// The walk over the *whole* file, which is what says a position is oversold. Being oversold is not a question about a day.
	walk: PositionWalk;

	// The computer's own clock, as the file writes a day
	today: IsoDate;
}

// The two running halves of one account's transactions, which is all a balance at a date needs
interface RunningAccount {
	insideValueAdjustment: number;
	outsideValueAdjustment: number;
}

/**
 * The day the file starts, which is the earliest of any account's opening date, any transaction's date and any trade's date —
 * not the earliest transaction.
 * @param document The ledger.
 * @returns The earliest day anything in the file is dated, or undefined for a file with nothing dated in it at all.
 */
const startOfFile = (document: LedgerDocument): IsoDate | undefined => {
	let earliest: IsoDate | undefined;

	const consider = (date: IsoDate): void => {
		if(earliest === undefined || date < earliest) {
			earliest = date;
		}
	};

	for(const account of document.accounts) {
		consider(account.openingDate);
	}

	for(const transaction of document.transactions) {
		consider(transaction.date);
	}

	for(const trade of document.trades) {
		consider(trade.date);
	}

	return earliest;
};

/**
 * The days the line is drawn at: each month end from the month the file starts in up to the last one before today, plus one at
 * today itself. **On a day that is itself a month end there is one point, not two.**
 * @param from The day the file starts.
 * @param today The computer's own clock.
 * @returns The days, ascending, ending at today.
 */
const pointDates = (from: IsoDate, today: IsoDate): IsoDate[] => {
	const dates: IsoDate[] = [];

	let year = Number(from.slice(0, 4));
	let month = Number(from.slice(5, 7));
	let monthEnd = lastDayOfMonth(year, month);

	while(monthEnd < today) {
		dates.push(monthEnd);

		if(month === 12) {
			year += 1;
			month = 1;
		}
		else {
			month += 1;
		}

		monthEnd = lastDayOfMonth(year, month);
	}

	dates.push(today);

	return dates;
};

/**
 * Draws the line: net worth at every month end of the file, and one final point at today.
 *
 * **The transactions are swept forwards rather than re-summed at every point**, the dates ascending and each account keeping the
 * two running halves a pension fund's split needs; the trades are re-walked at each point instead, the weighted-average walk
 * being an ordered state and not a sum.
 * @param options What the line is drawn from.
 * @param options.document The ledger.
 * @param options.walk The walk over the whole file, which is what says a position is oversold.
 * @param options.today The computer's own clock.
 * @returns The points, ascending, or nothing at all for a file with nothing dated in it.
 */
export const deriveNetWorthSeries = ({ document, walk, today }: NetWorthSeriesOptions): NetWorthPoint[] => {
	const start = startOfFile(document);

	if(start === undefined) {
		return [];
	}

	const securities = indexSecurities(document.securities);
	const institutions = indexInstitutions(document.institutions);
	const priceHistories = indexPriceHistories(document.prices);
	const valueAdjustmentCategoryIds = categoryIdsWithRole(document.categories, 'value-adjustment');
	const accounts = new Map(document.accounts.map((account) => {
		return [ account.id, account ];
	}));

	const transactions = [ ...document.transactions ].sort((first, second) => {
		return first.date < second.date ? -1 : 1;
	});

	const running = new Map<LedgerId, RunningAccount>(document.accounts.map((account) => {
		return [ account.id, { insideValueAdjustment: 0, outsideValueAdjustment: 0 } ];
	}));

	let swept = 0;

	return pointDates(start, today).map((date): NetWorthPoint => {
		while(swept < transactions.length && transactions[swept].date <= date) {
			const transaction = transactions[swept];
			const standing = running.get(transaction.accountId);

			if(standing) {
				if(transaction.categoryId !== null && valueAdjustmentCategoryIds.has(transaction.categoryId)) {
					standing.insideValueAdjustment += transaction.amount;
				}
				else {
					standing.outsideValueAdjustment += transaction.amount;
				}
			}

			swept += 1;
		}

		let value = 0;

		for(const account of document.accounts) {
			// An account contributes nothing before it existed
			if(account.openingDate > date || !isCashAccountType(account.type)) {
				continue;
			}

			const standing = running.get(account.id) ?? { insideValueAdjustment: 0, outsideValueAdjustment: 0 };

			if(isPensionFund(account)) {
				value += widenToWorkingScale(netPensionFund({
					account,
					contributions: account.openingBalance + standing.outsideValueAdjustment,
					revaluation: standing.insideValueAdjustment
				}).balance, MONEY_SCALES.amount);

				continue;
			}

			value += widenToWorkingScale(
				account.openingBalance + standing.outsideValueAdjustment + standing.insideValueAdjustment,
				MONEY_SCALES.amount
			);
		}

		let fromCost = false;

		for(const position of walkPositions(document.trades, date).positions.values()) {
			const account = accounts.get(position.accountId);
			const security = securities.get(position.securityId);

			if(position.quantity <= 0 || position.avgCost === undefined || !account || !security || account.openingDate > date) {
				continue;
			}

			// Whether the position broke is asked of the whole file, so a point before the break carries nothing either
			if(walk.positions.get(positionKey(position.securityId, position.accountId))?.oversold !== false) {
				continue;
			}

			const invested = multiplyWorkingScaleByQuantityScale(position.avgCost, position.quantity);
			const history = priceHistories.get(position.securityId);
			const price = history ? priceOnOrBefore(history, date) : undefined;

			// No price to value it at — whether none yet or none ever — is one state, and the valuation carries it at cost
			if(!price) {
				fromCost = true;
			}

			const institution = account.institutionId === null ? undefined : institutions.get(account.institutionId);

			value += valueHolding({
				quantity: position.quantity,
				invested,
				price: price?.value,
				sellFee: institution?.defaultSellFee ?? 0,
				taxRate: security.taxRate
			}).netProceeds;
		}

		return { date, value, fromCost };
	});
};

/**
 * The three stretches of the line the chart may be read over ([§3.1]).
 */
export const NET_WORTH_WINDOWS = [ '1-year', '5-years', 'all' ] as const;

export type NetWorthWindow = typeof NET_WORTH_WINDOWS[number];

// How many points each window keeps: twelve month ends and today, sixty month ends and today, and every point there is
const WINDOW_POINTS: Record<NetWorthWindow, number> = {
	'1-year': 13,
	'5-years': 61,
	all: Number.POSITIVE_INFINITY
};

/**
 * The stretch of the line a window draws.
 *
 * **It cuts the view and never the arithmetic.** Every point kept is net worth at its own date, computed from the start of the
 * file exactly as it was before the cut, and no point is rebased to the left edge of the window: the line is the headline
 * quantity wherever it is cut, which is the whole reason it may be cut at all. **The last point is today's under all three
 * windows**, so the equality with the headline holds whichever one is showing.
 *
 * **A file shorter than the window keeps everything it has**, which is what lets the three be offered whatever the file holds.
 * @param points The whole line, ascending.
 * @param window Which stretch of it is showing.
 * @returns The points that window draws, ascending, ending at today.
 */
export const windowNetWorthPoints = (points: readonly NetWorthPoint[], window: NetWorthWindow): readonly NetWorthPoint[] => {
	const kept = WINDOW_POINTS[window];

	return points.length <= kept ? points : points.slice(points.length - kept);
};
