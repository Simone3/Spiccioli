import { compareNames } from 'src/logic/accounts/Accounts';
import { indexPricesByDay, priceOnDayIndexed, sortSecurities } from 'src/logic/investments/Securities';
import { DateUtils } from 'src/framework/utils/DateUtils';
import type { IsoDate, LedgerId, Price, Security, TenThousandths, Trade } from 'src/types/LedgerTypes';
import type {
	PriceFetchOutcome,
	PriceListingRequest,
	PricePassResult,
	PriceQuoteRefusal,
	QuotedDay
} from 'src/types/PriceIpcTypes';

/**
 * Everything pure about a price pass: what is asked for, what came back read against the file, and what confirming would write.
 *
 * **A pass covers every security in the file, held or fully sold.** A position that is closed still has a history worth pricing
 * and there is no list to tick first, so what goes out is one listing per security and nothing narrows it.
 *
 * **What differs per security is how far back it is asked for**, and that is worked out here: the day after its most recent
 * price, or the day of its first purchase where it holds no price at all. A security with neither has no history to build and is
 * asked for the latest quote alone, whichever pass this is.
 *
 * **Nothing here writes anything either.** It reports what would be written and over what — the value the day currently holds,
 * and whether that value was typed by hand or fetched — and the records it produces are handed to the document only after the
 * user has confirmed the panel. **Cancel and none of this is called.**
 */

// One security that got a quote: its newest day, what that day currently holds, and the whole series behind it
export interface PriceUpdateRow {
	security: Security;

	// The newest day that came back, which is the whole of what came back where the latest quote was asked for
	value: TenThousandths;
	date: IsoDate;

	// What that day holds today, or undefined where the day is new
	replaces: Price | undefined;

	// Every day that came back, oldest first. This is what confirming writes, and for the shorter pass it is the one day above.
	days: QuotedDay[];

	// How many of those days already hold a price, and how many of those were typed by hand
	replacesCount: number;
	replacesManualCount: number;

	// Days that came back and will not be written: the ones a refusal took down, and the ones carrying no figure at all
	droppedCount: number;
}

// One security nothing will be written for. It keeps the price it has, whichever of the three this is.
export type PriceUpdateProblem = {
	security: Security;
} & ({
	reason: 'no-quote';
} | {
	reason: 'refused';
	refusal: PriceQuoteRefusal;
	currency: string | null;
} | {
	reason: 'failed';
	message: string;
});

export interface PriceUpdateReview {

	// The moment the provider's figures are as of, where it states one at all
	referenceDate: IsoDate | undefined;

	rows: PriceUpdateRow[];
	problems: PriceUpdateProblem[];

	// The day every quote belongs to, where they all belong to one. Undefined where the pass came back spread over several days.
	commonDate: IsoDate | undefined;

	// How many days would be written in total, which for the shorter pass is one per row
	dayCount: number;

	// How many of those days would replace a value, and how many of those were typed by hand — which is the part worth stating
	replacedCount: number;
	replacedManualCount: number;

	// Days that came back across the whole pass and will not be written
	droppedCount: number;
}

/**
 * Which of the two passes is being run, chosen once and applied to every security.
 *
 * **`latest`** asks each security for the one figure the provider has now. **`history`** asks each of them for every day since
 * the file last knew a price, which is what fills a history in at first setup.
 */
export type PricePassSpan = 'latest' | 'history';

// The newest day a security holds a price for, where it holds any
const lastPricedDay = (prices: readonly Price[], securityId: LedgerId): IsoDate | undefined => {
	return prices.reduce<IsoDate | undefined>((latest, price) => {
		return price.securityId === securityId && (latest === undefined || price.date > latest) ? price.date : latest;
	}, undefined);
};

// The day a security was first bought on, which is the earliest day it could sensibly carry a price for
const firstPurchasedDay = (trades: readonly Trade[], securityId: LedgerId): IsoDate | undefined => {
	return trades.reduce<IsoDate | undefined>((earliest, trade) => {
		const wanted = trade.securityId === securityId && trade.kind === 'purchase';

		return wanted && (earliest === undefined || trade.date < earliest) ? trade.date : earliest;
	}, undefined);
};

const dayAfter = (date: IsoDate): IsoDate => {
	const parsed = DateUtils.fromStandardYearMonthDay(date);

	return parsed === undefined ? date : DateUtils.toStandardYearMonthDay(DateUtils.addDays(parsed, 1));
};

/**
 * Works out how far back one security is asked for.
 *
 * **The day after its most recent price**, so that nothing already recorded is asked for again; **the day of its first purchase**
 * where it holds no price at all, that being the earliest day it could sensibly carry one; and **nothing at all** where it has
 * neither, which is a security with no history to build.
 *
 * **Never later than today.** A security already priced today would otherwise be asked for a span that begins tomorrow and
 * contains nothing, and would come back reported as one the provider carries no quote for — which is not what happened to it.
 * Asked from today instead, it is refreshed exactly as the shorter pass would refresh it.
 * @param securityId The security.
 * @param prices Every price in the file.
 * @param trades Every trade in the file.
 * @param today The day the pass is being run on.
 * @returns The first day wanted, or null where there is no history to ask for.
 */
export const toListingStart = (
	securityId: LedgerId,
	prices: readonly Price[],
	trades: readonly Trade[],
	today: IsoDate
): IsoDate | null => {
	const priced = lastPricedDay(prices, securityId);
	const from = priced === undefined ? firstPurchasedDay(trades, securityId) : dayAfter(priced);

	if(from === undefined) {
		return null;
	}

	return from > today ? today : from;
};

/**
 * Builds what goes out: one listing per security in the file, in the order the screen shows them.
 *
 * The identity travels with each listing so that an answer can be matched back to the security it belongs to; **it goes no
 * further than the main process**, which asks the provider for the ticker and the exchange alone. **The first day wanted travels
 * with it too**, and is the only other thing a listing carries.
 * @param securities Every security in the file.
 * @param span Which of the two passes is being run.
 * @param prices Every price in the file, which is what says where a history left off.
 * @param trades Every trade in the file, which is what says where one could begin.
 * @param today The day the pass is being run on.
 * @returns One listing each, ordered by ticker.
 */
export const toPriceListings = (
	securities: readonly Security[],
	span: PricePassSpan,
	prices: readonly Price[],
	trades: readonly Trade[],
	today: IsoDate
): PriceListingRequest[] => {
	return sortSecurities(securities).map((security) => {
		return {
			securityId: security.id,
			ticker: security.ticker,
			exchange: security.exchange,
			from: span === 'latest' ? null : toListingStart(security.id, prices, trades, today)
		};
	});
};

const readSecurity = (securities: ReadonlyMap<LedgerId, Security>, outcome: PriceFetchOutcome): Security | undefined => {
	return securities.get(outcome.securityId);
};

/**
 * Reads one security's days against the file.
 *
 * **The row reads as the shorter pass's row does** — the newest day, and what that day currently holds — because that is the
 * figure anybody looking at a holding wants to see. What a series adds is the count beneath it: how many days it carries, and
 * how many of them land on a value that is already there.
 * @param security The security.
 * @param days Every day that came back for it, oldest first.
 * @param droppedCount Days that came back and will not be written.
 * @param byDay Every price in the file, by security and day.
 * @returns The row.
 */
const toRow = (
	security: Security,
	days: QuotedDay[],
	droppedCount: number,
	byDay: ReadonlyMap<string, Price>
): PriceUpdateRow => {
	const newest = days[days.length - 1];
	const replaced = days.map((day) => {
		return priceOnDayIndexed(byDay, security.id, day.date);
	}).filter((price): price is Price => {
		return price !== undefined;
	});

	return {
		security,
		value: newest.value,
		date: newest.date,
		replaces: priceOnDayIndexed(byDay, security.id, newest.date),
		days,
		droppedCount,
		replacesCount: replaced.length,
		replacesManualCount: replaced.filter((price) => {
			return price.source === 'manual';
		}).length
	};
};

/**
 * Reads what came back against the file, which is what the review panel is made of.
 *
 * An outcome naming a security the file no longer holds is dropped: a pass takes time, and a security deleted while it was
 * running has no row to describe and nothing to write against.
 * @param result What the pass came back with.
 * @param securities The securities of the file, by identity.
 * @param prices Every price in the file, which is what says whether a day is new.
 * @returns The review, both halves ordered by ticker.
 */
export const reviewPricePass = (
	result: PricePassResult,
	securities: ReadonlyMap<LedgerId, Security>,
	prices: readonly Price[]
): PriceUpdateReview => {
	const rows: PriceUpdateRow[] = [];
	const problems: PriceUpdateProblem[] = [];

	// Built once and asked of every day, rather than the file being walked once per day of every series
	const byDay = indexPricesByDay(prices);

	for(const outcome of result.outcomes) {
		const security = readSecurity(securities, outcome);

		if(!security) {
			continue;
		}

		if(outcome.outcome === 'quoted') {
			rows.push(toRow(security, outcome.days, outcome.droppedCount, byDay));
		}
		else if(outcome.outcome === 'refused') {
			problems.push({ security, reason: 'refused', refusal: outcome.refusal, currency: outcome.currency });
		}
		else if(outcome.outcome === 'failed') {
			problems.push({ security, reason: 'failed', message: outcome.message });
		}
		else {
			problems.push({ security, reason: 'no-quote' });
		}
	}

	// Both halves of the panel read by ticker, like every other list of securities in the application
	const byTicker = (first: { security: Security }, second: { security: Security }): number => {
		const byCode = compareNames(first.security.ticker, second.security.ticker);

		return byCode === 0 ? compareNames(first.security.name, second.security.name) : byCode;
	};

	rows.sort(byTicker);
	problems.sort(byTicker);

	const dates = new Set(rows.map((row) => {
		return row.date;
	}));
	const total = (read: (row: PriceUpdateRow) => number): number => {
		return rows.reduce((sum, row) => {
			return sum + read(row);
		}, 0);
	};

	return {
		referenceDate: result.referenceDate ?? undefined,
		rows,
		problems,
		commonDate: dates.size === 1 ? [ ...dates ][0] : undefined,
		dayCount: total((row) => {
			return row.days.length;
		}),
		replacedCount: total((row) => {
			return row.replacesCount;
		}),
		replacedManualCount: total((row) => {
			return row.replacesManualCount;
		}),
		droppedCount: total((row) => {
			return row.droppedCount;
		})
	};
};

/**
 * Turns the rows the panel showed into the records confirming writes.
 *
 * **Every one of them is `fetched`**, a hand-typed value it replaces included: a day holds one price, the last word on it wins,
 * and what the history then shows against that day is what the record says it is.
 * @param rows The rows the panel showed.
 * @returns The Price records to write.
 */
export const toFetchedPrices = (rows: readonly PriceUpdateRow[]): Price[] => {
	return rows.flatMap((row) => {
		return row.days.map((day) => {
			return {
				securityId: row.security.id,
				date: day.date,
				value: day.value,
				source: 'fetched' as const
			};
		});
	});
};
