import { formatAccountName, compareNames, indexInstitutions } from 'src/logic/accounts/Accounts';
import { indexLatestPrices, indexSecurities } from 'src/logic/investments/Securities';
import { tradeTotalWorking, type WorkingAmount } from 'src/logic/investments/Trades';
import {
	divideAtWorkingScale,
	MONEY_SCALES,
	multiplyQuantityByRateScale,
	multiplyWorkingScaleByQuantityScale,
	multiplyWorkingScaleByRateScale,
	narrowFromWorkingScale,
	roundWorkingScaleToCents,
	widenToWorkingScale
} from 'src/logic/money/Money';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type { Cents, IsoDate, LedgerDocument, LedgerId, Millionths, TenThousandths, Trade, TradeKind } from 'src/types/LedgerTypes';

/**
 * The weighted-average-cost walk, the holdings it derives, and what each one would leave you with if it were sold today.
 *
 * **The walk order is a total order and is the whole of what makes these figures reproducible**: `date ASC, purchases before
 * sales, insertionSeq ASC, id ASC`. Purchases come first on a date they share with a sale, so a security bought and sold in one
 * day is an ordinary round trip and not a position that dipped below zero.
 *
 * **A sale that takes the running quantity below zero ends the walk for that (security, account), and nothing at all is derived
 * from it thereafter** — no holding, no average cost, no invested total, no gain, no valuation and no realised gain on any of its
 * sales, whatever the walk ends at. A dip disqualifies the position rather than the moment it happened in, so a walk brought back
 * above zero by a later purchase yields no holding either. The checks name the trade instead.
 *
 * **Every money figure here is at the working scale of eight decimal places** and is narrowed to the cent once, at display. The
 * two roundings that happen before that are named by the calculations and are both here: the hypothetical tax, and the average
 * cost the whole walk turns on, which is the one division.
 */

// Where a purchase and a sale sharing a date fall in the walk. It is the one place the order of two trades on one day matters.
const WALK_KIND_ORDER: Record<TradeKind, number> = {
	purchase: 0,
	sale: 1
};

/** One (security, account) as the walk leaves it. A position that went below zero carries nothing that can be read. */
export interface Position {
	securityId: LedgerId;
	accountId: LedgerId;
	purchasedQuantity: Millionths;
	soldQuantity: Millionths;
	quantity: Millionths;

	// How many purchase trades the quantity came from, which the detail panel states beside it
	lotCount: number;

	costBasis: WorkingAmount;

	// Undefined until the first purchase gives it one, and again after a sale takes the position to exactly zero
	avgCost: WorkingAmount | undefined;

	// Whether the running quantity ever went below zero, which disqualifies the position outright
	oversold: boolean;

	// The sale that took it there, which is the record check 8 names. Undefined on every position that is sound.
	oversoldTrade: Trade | undefined;

	// Every trade of this position, in walk order, which is what the annualised return reads
	trades: readonly Trade[];
}

export interface PositionWalk {
	positions: ReadonlyMap<string, Position>;

	// The realised gain per sale, and no entry at all where there is none to state
	realisedGains: ReadonlyMap<LedgerId, WorkingAmount>;
}

/** A position that is still open, with everything the Holdings tab and its detail panel show. */
export interface Holding {
	securityId: LedgerId;
	accountId: LedgerId;
	purchasedQuantity: Millionths;
	soldQuantity: Millionths;
	quantity: Millionths;
	lotCount: number;

	// Per unit, at the working scale: the one figure in the application that comes out of a division
	avgCost: WorkingAmount;
	invested: WorkingAmount;

	// Undefined where the security has no Price record at all, which is what values the holding at nothing
	price: TenThousandths | undefined;
	priceDate: IsoDate | undefined;

	marketValue: WorkingAmount;
	gain: WorkingAmount;

	// A fraction in ten-thousandths, and undefined on a position that cost nothing
	gainPct: TenThousandths | undefined;

	// The hypothetical liquidation, gross of nothing and net of everything
	sellFee: WorkingAmount;
	taxableGain: WorkingAmount;
	tax: WorkingAmount;
	netProceeds: WorkingAmount;
	netGain: WorkingAmount;
	netGainPct: TenThousandths | undefined;
}

// What the Securities tab's *Held* column says: the quantity across every brokerage account, or that nothing can be said
export interface SecurityPosition {
	quantity: Millionths;
	oversold: boolean;
}

export interface HoldingsTotals {
	value: WorkingAmount;
	gain: WorkingAmount;

	// Σ gain ÷ (Σ value − Σ gain), the denominator being what the positions cost, and undefined where that is zero
	gainPct: TenThousandths | undefined;
}

/** What valuing a position as if it had been sold takes: the quantity, what it cost, what it is worth and what selling costs. */
export interface HoldingValuationOptions {
	quantity: Millionths;

	// Quantity times the average cost, at the working scale
	invested: WorkingAmount;

	// The price the position is valued at, or undefined where there is none to value it at
	price: TenThousandths | undefined;

	// The institution's default sell fee, in cents. Charged once per holding, and not at all where there is no price.
	sellFee: Cents;

	taxRate: TenThousandths;
}

/** One position, valued at its price and again as if it had been sold at it. Every figure is at the working scale. */
export interface HoldingValuation {
	marketValue: WorkingAmount;
	gain: WorkingAmount;
	sellFee: WorkingAmount;
	taxableGain: WorkingAmount;
	tax: WorkingAmount;
	netProceeds: WorkingAmount;
	netGain: WorkingAmount;
}

export interface HoldingsOptions {
	document: LedgerDocument;
	walk: PositionWalk;

	// The wording an account name is written with, this being one of the places the institution has no column of its own
	translator: SpiccioliTranslator;
}

interface WalkingPosition extends Omit<Position, 'trades'> {
	trades: Trade[];
}

/**
 * The key a (security, account) is held under. The account is always a `Brokerage` one.
 * @param securityId The security.
 * @param accountId The brokerage account.
 * @returns The key.
 */
export const positionKey = (securityId: LedgerId, accountId: LedgerId): string => {
	return `${securityId}|${accountId}`;
};

/**
 * Orders two trades the way the walk reaches them, which is the one order every figure below is reproducible under.
 * @param first The first trade.
 * @param second The second trade.
 * @returns Negative when the first is walked before the second, positive when after.
 */
export const compareTradesInWalkOrder = (first: Trade, second: Trade): number => {
	if(first.date !== second.date) {
		return first.date < second.date ? -1 : 1;
	}

	if(first.kind !== second.kind) {
		return WALK_KIND_ORDER[first.kind] - WALK_KIND_ORDER[second.kind];
	}

	if(first.insertionSeq !== second.insertionSeq) {
		return first.insertionSeq - second.insertionSeq;
	}

	return first.id < second.id ? -1 : 1;
};

const emptyPosition = (securityId: LedgerId, accountId: LedgerId): WalkingPosition => {
	return {
		securityId,
		accountId,
		purchasedQuantity: 0,
		soldQuantity: 0,
		quantity: 0,
		lotCount: 0,
		costBasis: 0,
		avgCost: undefined,
		oversold: false,
		oversoldTrade: undefined,
		trades: []
	};
};

/**
 * Walks every trade in the file and leaves each (security, account) where its trades put it.
 *
 * A purchase adds its quantity, adds what it cost including its fees to the cost basis and recomputes the average; a sale takes
 * its quantity out and takes that many units of the average out of the basis, leaving the average itself alone. A sale that lands
 * on exactly zero clears both. **A sale that goes below zero ends that position's walk**, and every realised gain it had already
 * produced is dropped with it: the position has no cost basis behind it, and neither has any sale in it.
 *
 * **A day the walk stops at is what the net worth line of [§11.5] reads**, the same walk taken over the trades recorded up to
 * that day. **Whether a position is oversold is not a question about a day**, though: a position that broke later has broken,
 * and the line asks the walk over the whole file which ones those are rather than asking this one.
 * @param trades Every trade in the file, in any order.
 * @param asOf The day to stop at, or undefined to walk the whole file.
 * @returns Each position as the walk left it, and the realised gain of every sale that has one.
 */
export const walkPositions = (trades: readonly Trade[], asOf?: IsoDate): PositionWalk => {
	const positions = new Map<string, WalkingPosition>();
	const realisedGains = new Map<LedgerId, WorkingAmount>();
	const walked = asOf === undefined ?
		trades :
		trades.filter((trade) => {
			return trade.date <= asOf;
		});

	for(const trade of [ ...walked ].sort(compareTradesInWalkOrder)) {
		const key = positionKey(trade.securityId, trade.accountId);
		let position = positions.get(key);

		if(!position) {
			position = emptyPosition(trade.securityId, trade.accountId);
			positions.set(key, position);
		}

		position.trades.push(trade);

		// The walk ended at the trade that broke this position, and nothing after it is derived
		if(position.oversold) {
			continue;
		}

		if(trade.kind === 'purchase') {
			position.purchasedQuantity += trade.quantity;
			position.quantity += trade.quantity;
			position.lotCount += 1;
			position.costBasis += tradeTotalWorking(trade);
			position.avgCost = divideAtWorkingScale(position.costBasis, widenToWorkingScale(position.quantity, MONEY_SCALES.quantity));

			continue;
		}

		const remaining = position.quantity - trade.quantity;

		if(remaining < 0 || position.avgCost === undefined) {
			position.oversold = true;
			position.oversoldTrade = trade;

			continue;
		}

		// Measured against the average in force at the time of the sale, which a sale never moves
		const cost = multiplyWorkingScaleByQuantityScale(position.avgCost, trade.quantity);

		realisedGains.set(trade.id, tradeTotalWorking(trade) - cost);
		position.soldQuantity += trade.quantity;
		position.quantity = remaining;

		if(remaining === 0) {
			position.costBasis = 0;
			position.avgCost = undefined;
		}
		else {
			position.costBasis -= cost;
		}
	}

	// A position that broke at any point has no cost basis behind any of its sales, the ones walked before the break included
	for(const position of positions.values()) {
		if(position.oversold) {
			for(const trade of position.trades) {
				realisedGains.delete(trade.id);
			}
		}
	}

	return { positions, realisedGains };
};

/**
 * Values one position at a price and again as if it had been sold at it, which is the holding half of [§11.3].
 *
 * **The sell fee comes out before the tax**, a selling commission reducing the gain the tax is computed on, and **the tax is
 * never negative** — a loss produces no rebate. **A position with no price is worth nothing, its gain is minus its cost, its tax
 * is nothing and no fee is charged**, since nothing is being sold. **`netProceeds` can be negative and that is correct**: a
 * position worth less than the fee to close it would cost money to close.
 *
 * It is written once here because two screens value a holding: Portfolio at today's price, and the net worth line at the most
 * recent price of each of its dates.
 * @param options What the position is valued from.
 * @param options.quantity The quantity held.
 * @param options.invested What that quantity cost, at the working scale.
 * @param options.price The price to value it at, or undefined where there is none.
 * @param options.sellFee The institution's default sell fee, in cents.
 * @param options.taxRate The security's tax rate, in ten-thousandths.
 * @returns The valuation, gross and net.
 */
export const valueHolding = ({ quantity, invested, price, sellFee, taxRate }: HoldingValuationOptions): HoldingValuation => {
	const marketValue = price === undefined ? 0 : multiplyQuantityByRateScale(quantity, price);

	// Nothing is being sold on a position nobody has ever valued, so no commission is estimated against it
	const fee = price === undefined ? 0 : widenToWorkingScale(sellFee, MONEY_SCALES.amount);
	const taxableGain = marketValue - fee - invested;
	const tax = taxableGain > 0 ? roundWorkingScaleToCents(multiplyWorkingScaleByRateScale(taxableGain, taxRate)) : 0;
	const netProceeds = marketValue - fee - tax;

	return {
		marketValue,
		gain: marketValue - invested,
		sellFee: fee,
		taxableGain,
		tax,
		netProceeds,
		netGain: netProceeds - invested
	};
};

/**
 * Derives the holdings: the positions that are still open, valued at the latest price and again as if they had been sold today.
 *
 * **The sell fee comes out before the tax**, a selling commission reducing the gain the tax is computed on, and the tax is never
 * negative — a loss produces no rebate. **A holding whose security has no price at all is worth nothing, its gain is minus its
 * cost, its tax is nothing and no fee is charged**, since nothing is being sold.
 * @param options What the holdings are derived from.
 * @param options.document The ledger.
 * @param options.walk The positions as the walk left them.
 * @param options.translator The wording an account name is written with.
 * @returns The holdings, by security ticker and then by account name.
 */
export const deriveHoldings = ({ document, walk, translator }: HoldingsOptions): Holding[] => {
	const securities = indexSecurities(document.securities);
	const institutions = indexInstitutions(document.institutions);
	const latestPrices = indexLatestPrices(document.prices);
	const accounts = new Map(document.accounts.map((account) => {
		return [ account.id, account ];
	}));

	const holdings: Holding[] = [];

	for(const position of walk.positions.values()) {
		if(position.oversold || position.quantity <= 0 || position.avgCost === undefined) {
			continue;
		}

		const security = securities.get(position.securityId);
		const account = accounts.get(position.accountId);

		if(!security || !account) {
			continue;
		}

		const institution = account.institutionId === null ? undefined : institutions.get(account.institutionId);
		const latest = latestPrices.get(position.securityId);
		const invested = multiplyWorkingScaleByQuantityScale(position.avgCost, position.quantity);
		const valuation = valueHolding({
			quantity: position.quantity,
			invested,
			price: latest?.value,
			sellFee: institution?.defaultSellFee ?? 0,
			taxRate: security.taxRate
		});

		const percentageOf = (figure: WorkingAmount): TenThousandths | undefined => {
			return invested === 0 ? undefined : narrowFromWorkingScale(divideAtWorkingScale(figure, invested), MONEY_SCALES.rate);
		};

		holdings.push({
			securityId: position.securityId,
			accountId: position.accountId,
			purchasedQuantity: position.purchasedQuantity,
			soldQuantity: position.soldQuantity,
			quantity: position.quantity,
			lotCount: position.lotCount,
			avgCost: position.avgCost,
			invested,
			price: latest?.value,
			priceDate: latest?.date,
			marketValue: valuation.marketValue,
			gain: valuation.gain,
			gainPct: percentageOf(valuation.gain),
			sellFee: valuation.sellFee,
			taxableGain: valuation.taxableGain,
			tax: valuation.tax,
			netProceeds: valuation.netProceeds,
			netGain: valuation.netGain,
			netGainPct: percentageOf(valuation.netGain)
		});
	}

	return holdings.sort((first, second) => {
		const byTicker = compareNames(securities.get(first.securityId)?.ticker ?? '', securities.get(second.securityId)?.ticker ?? '');

		if(byTicker !== 0) {
			return byTicker;
		}

		const nameOf = (holding: Holding): string => {
			const account = accounts.get(holding.accountId);

			return account ? formatAccountName(account, institutions, translator) : '';
		};

		return compareNames(nameOf(first), nameOf(second));
	});
};

/**
 * Totals the two money columns of the Holdings footer and states the percentage they make.
 *
 * The denominator is what the positions cost — Σ value less Σ gain — so the figure is the gross return on the money still in the
 * market. A holding with no price contributes nothing to the value and minus its cost to the gain, exactly as its row does, so
 * **neither total states an omission**: every figure exists.
 * @param holdings The holdings.
 * @returns The two totals and the percentage they make.
 */
export const totalHoldings = (holdings: readonly Holding[]): HoldingsTotals => {
	const value = holdings.reduce((running, holding) => {
		return running + holding.marketValue;
	}, 0);
	const gain = holdings.reduce((running, holding) => {
		return running + holding.gain;
	}, 0);
	const invested = value - gain;

	return {
		value,
		gain,
		gainPct: invested === 0 ? undefined : narrowFromWorkingScale(divideAtWorkingScale(gain, invested), MONEY_SCALES.rate)
	};
};

/**
 * Sums each security's quantity across every brokerage account, closed ones included.
 *
 * **A security oversold in any account can say nothing about what is held**: no holding is derived for that (security, account),
 * and a sum over the others would read as the position. The whole security is marked instead, which is what the tinted em dash of
 * the Securities tab says.
 * @param walk The positions as the walk left them.
 * @returns One entry per security that has been traded.
 */
export const summariseSecurityPositions = (walk: PositionWalk): Map<LedgerId, SecurityPosition> => {
	const summary = new Map<LedgerId, SecurityPosition>();

	for(const position of walk.positions.values()) {
		const standing = summary.get(position.securityId) ?? { quantity: 0, oversold: false };

		summary.set(position.securityId, {
			quantity: position.oversold ? standing.quantity : standing.quantity + position.quantity,
			oversold: standing.oversold || position.oversold
		});
	}

	return summary;
};
