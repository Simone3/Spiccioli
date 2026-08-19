import { DateUtils } from 'src/framework/utils/DateUtils';
import { positionKey, type Holding, type PositionWalk } from 'src/logic/investments/Holdings';
import { indexLatestPrices } from 'src/logic/investments/Securities';
import { tradeGrossWorking, type WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, multiplyQuantityByRateScale, roundHalfAwayFromZero, widenToWorkingScale } from 'src/logic/money/Money';
import type { IsoDate, LedgerDocument, TenThousandths, Trade } from 'src/types/LedgerTypes';

/**
 * The one figure in the application that says how *well* the investments have done rather than by how much.
 *
 * It is a **money-weighted return**: the constant annual rate which, applied to every euro from the day it went in until it came
 * out or until today, reproduces exactly what is held now. A plain gain percentage is a ratio of two amounts with no time in it,
 * and on a position built by twenty purchases across eight years it is comparable with nothing at all.
 *
 * **It is gross**: no capital-gains tax on either side, neither the hypothetical one nor the tax a broker actually withheld, which
 * is why a sale's flow adds that tax back. Commissions are in it on both sides, a commission being money that never went to work.
 *
 * **The bracket, the halving count and the arithmetic are all specified rather than chosen here.** An iteration with an unstated
 * bracket, an unstated stopping rule or an unstated arithmetic is a figure two machines can disagree about, and naming the
 * arithmetic is what the other two rest on: a fixed count of halvings is only a fixed answer if the halving is the same operation
 * everywhere. Everything below is IEEE-754 binary64 throughout.
 */

// The bracket the rate is searched in: a return worse than this is a total loss, and one better than it is not worth printing
const LOWEST_RATE = -0.999;

const HIGHEST_RATE = 10;

/**
 * How many times the bracket is halved. It is a margin rather than a calculation: a bracket this wide stops shrinking somewhere
 * around the sixtieth halving, a binary64 midpoint by then being equal to one of its own endpoints, and every halving after that
 * returns the same number.
 */
const HALVINGS = 100;

// Days are counted actual and the year is a constant. No month arithmetic and no leap-year rule.
const DAYS_PER_YEAR = 365;

// A rate is shown as a percentage, so it leaves here as the fraction every other percentage in the application is stored as
const RATE_SCALE = MONEY_SCALES.rate;

/** One movement of money, on the day it happened. Negative is money going in. */
export interface CashFlow {
	date: IsoDate;
	amount: WorkingAmount;
}

/** What the portfolio-wide figure covers, and what it had to leave out whole. */
export interface PortfolioReturn {

	// A fraction in ten-thousandths, and undefined in every case the calculations name
	rate: TenThousandths | undefined;

	// (security, account) pairs left out entirely — oversold, or with no price ever recorded
	omitted: number;
}

const daysBetween = (from: IsoDate, to: IsoDate): number => {
	const start = DateUtils.fromStandardYearMonthDay(from);
	const end = DateUtils.fromStandardYearMonthDay(to);

	if(!start || !end) {
		return 0;
	}

	return DateUtils.dayOffsetFromToday(end) - DateUtils.dayOffsetFromToday(start);
};

/**
 * What the flows are worth at the earliest of their dates, discounted at a rate.
 * @param flows The flows, and the day each one happened.
 * @param earliest The day the exponents are measured from.
 * @param rate The rate being tried.
 * @returns The present value, which the rate is the root of.
 */
const presentValueAt = (flows: readonly CashFlow[], earliest: IsoDate, rate: number): number => {
	return flows.reduce((running, flow) => {
		return running + flow.amount * (1 + rate) ** (-daysBetween(earliest, flow.date) / DAYS_PER_YEAR);
	}, 0);
};

/**
 * Builds the flows one position produces: a purchase going out, a sale coming in with its tax added back, and what is still held
 * coming in today.
 *
 * **A position sold in full contributes no terminal flow at all**, its sales being the whole of what came back.
 * @param trades The position's trades.
 * @param terminalValue What the open part of the position is worth today, at the working scale.
 * @param today The day the terminal flow falls on.
 * @returns The flows, in the order the trades were walked in.
 */
export const buildCashFlows = (trades: readonly Trade[], terminalValue: WorkingAmount, today: IsoDate): CashFlow[] => {
	const flows: CashFlow[] = trades.map((trade) => {
		const fees = widenToWorkingScale(trade.fees, MONEY_SCALES.amount);
		const gross = tradeGrossWorking(trade);

		return {
			date: trade.date,
			amount: trade.kind === 'purchase' ? -(gross + fees) : gross - fees
		};
	});

	if(terminalValue !== 0) {
		flows.push({ date: today, amount: terminalValue });
	}

	return flows;
};

/**
 * Solves for the rate the flows reconcile to, by bisection.
 *
 * It reads *undefined* rather than zero in every case the calculations name: fewer than two flows or every flow of one sign, where
 * there is nothing for a rate to reconcile; every flow on one day, where the exponent is zero throughout and no rate changes
 * anything; and no sign change across the bracket, which is a return worse than −99,9% or better than +1000% a year.
 *
 * **Where the flows change sign more than once, more than one rate can satisfy the equation.** The bisection returns one of them
 * and returns the same one on every machine; it does not claim the figure is unique.
 * @param flows The flows.
 * @returns The rate as a fraction in ten-thousandths, or undefined where there is none to state.
 */
export const annualisedReturn = (flows: readonly CashFlow[]): TenThousandths | undefined => {
	if(flows.length < 2) {
		return undefined;
	}

	const hasIncoming = flows.some((flow) => {
		return flow.amount > 0;
	});
	const hasOutgoing = flows.some((flow) => {
		return flow.amount < 0;
	});

	if(!hasIncoming || !hasOutgoing) {
		return undefined;
	}

	const dates = flows.map((flow) => {
		return flow.date;
	});
	const earliest = dates.reduce((first, date) => {
		return date < first ? date : first;
	});

	// Every flow on one day: a position opened and closed this morning made a profit and has no annual rate
	if(dates.every((date) => {
		return date === earliest;
	})) {
		return undefined;
	}

	const atLowest = presentValueAt(flows, earliest, LOWEST_RATE);
	const atHighest = presentValueAt(flows, earliest, HIGHEST_RATE);

	const isPositiveAtLowest = atLowest > 0;

	if(!Number.isFinite(atLowest) || !Number.isFinite(atHighest) || isPositiveAtLowest === (atHighest > 0)) {
		return undefined;
	}

	let low = LOWEST_RATE;
	let high = HIGHEST_RATE;

	for(let halving = 0; halving < HALVINGS; halving += 1) {
		const middle = (low + high) / 2;

		if((presentValueAt(flows, earliest, middle) > 0) === isPositiveAtLowest) {
			low = middle;
		}
		else {
			high = middle;
		}
	}

	return roundHalfAwayFromZero((low + high) / 2 * 10 ** RATE_SCALE);
};

/**
 * The annualised return of one holding, which is every trade in that position plus what it is worth today.
 *
 * **A holding whose security has no price at all reads *undefined* rather than a rate**, and this is the one place the cost
 * fallback of [§11.3] is refused. The holding is carried at its cost everywhere else, and a terminal flow at cost solves
 * perfectly well — to a rate of about zero, a position that earned nothing, which is a performance claim nobody measured and is
 * indistinguishable on screen from a real one. An amount standing on cost is a fallback the reader can see; a rate standing on it
 * is a fabrication. Check 3 says why instead.
 * @param holding The holding.
 * @param walk The positions as the walk left them.
 * @param today Today, as the file writes a day.
 * @returns The rate as a fraction in ten-thousandths, or undefined where there is none to state.
 */
export const holdingAnnualisedReturn = (
	holding: Holding,
	walk: PositionWalk,
	today: IsoDate
): TenThousandths | undefined => {
	const position = walk.positions.get(positionKey(holding.securityId, holding.accountId));

	// A rate is the one figure that may not rest on the cost an unpriced holding is carried at
	if(!position || holding.price === undefined) {
		return undefined;
	}

	return annualisedReturn(buildCashFlows(position.trades, holding.marketValue, today));
};

/**
 * The portfolio-wide annualised return: **every trade in the file**, positions since sold in full included — those being exactly
 * the ones a lifetime performance figure must not drop — against the value of everything still open.
 *
 * **Two kinds of (security, account) are left out entirely, and the figure says how many**: an oversold one, which derives no
 * holding and so has no terminal value at all, and one whose security has no Price record at all, which has no *measured* one —
 * the cost it is carried at everywhere else being a fallback, and a rate the one figure that may not rest on it. **Left out means
 * every flow in that position and not merely its terminal one** — dropping the terminal flow alone would leave the purchases
 * behind and report a position that returned nothing, which is a rate arrived at by omission rather than by arithmetic. A holding
 * whose price is merely stale is not left out.
 * @param document The ledger.
 * @param walk The positions as the walk left them.
 * @param today Today, as the file writes a day.
 * @returns The rate and the count of the positions it could not cover.
 */
export const portfolioAnnualisedReturn = (document: LedgerDocument, walk: PositionWalk, today: IsoDate): PortfolioReturn => {
	const latestPrices = indexLatestPrices(document.prices);
	const flows: CashFlow[] = [];
	let omitted = 0;

	for(const position of walk.positions.values()) {
		const latest = latestPrices.get(position.securityId);

		if(position.oversold || !latest) {
			omitted += 1;

			continue;
		}

		const terminalValue = position.quantity > 0 ? multiplyQuantityByRateScale(position.quantity, latest.value) : 0;

		flows.push(...buildCashFlows(position.trades, terminalValue, today));
	}

	return { rate: annualisedReturn(flows), omitted };
};
