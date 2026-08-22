import { PRICE_HISTORY_CONFIG } from 'src/config/AppConfig';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { FIRST_PAGE, pageCountOf, pageHolding, pageOf } from 'src/framework/utils/Paging';
import { compareNames, isSameName } from 'src/logic/accounts/Accounts';
import type { IsoDate, LedgerDocument, LedgerId, Price, Security } from 'src/types/LedgerTypes';

/**
 * Everything pure about securities and their prices: how they are ordered, what points at one, what makes an ISIN a duplicate,
 * and which price a day reads.
 *
 * **A security is ordered by its `ticker` wherever it appears** — the Holdings tab and the Securities tab alike — with the same
 * case- and accent-insensitive comparison every other name in the application is ordered by. **Its price history is the one table
 * in the application that reads newest first**, and it pages, a history of years being longer than a panel: the first page is
 * the most recent records, and the pager is how the rest is walked back.
 *
 * A price belongs to the security and not to a holding, so the same instrument held at two brokers is two holdings and one price
 * history. **One price per security per day**: recording a second one for a day replaces it, and that is what makes the day the
 * key rather than a record of its own.
 */

// How many records point at a security. Only the trades decide whether it can be deleted; the prices go with it.
export interface SecurityUsage {
	trades: number;
	prices: number;
}

export interface IsinQuery {
	securities: readonly Security[];
	isin: string;

	// The security being corrected, which is never a duplicate of itself
	exceptId?: LedgerId;
}

/**
 * Orders securities the one way they are shown: by ticker, alphabetically.
 * @param securities The securities.
 * @returns The securities, ordered.
 */
export const sortSecurities = (securities: readonly Security[]): Security[] => {
	return [ ...securities ].sort((first, second) => {
		const byTicker = compareNames(first.ticker, second.ticker);

		return byTicker === 0 ? compareNames(first.name, second.name) : byTicker;
	});
};

/**
 * Indexes the securities by their identity, which is how a trade, a holding and a price reach the one they belong to.
 * @param securities The securities.
 * @returns The securities, by id.
 */
export const indexSecurities = (securities: readonly Security[]): Map<LedgerId, Security> => {
	return new Map(securities.map((security) => {
		return [ security.id, security ];
	}));
};

/**
 * Counts what points at each security: its trades, which block a deletion, and its prices, which do not.
 * @param document The ledger.
 * @returns One entry per security, including the securities nothing points at.
 */
export const countSecurityUsage = (document: LedgerDocument): Map<LedgerId, SecurityUsage> => {
	const usage = new Map<LedgerId, SecurityUsage>();

	for(const security of document.securities) {
		usage.set(security.id, { trades: 0, prices: 0 });
	}

	for(const trade of document.trades) {
		const entry = usage.get(trade.securityId);

		if(entry) {
			entry.trades += 1;
		}
	}

	for(const price of document.prices) {
		const entry = usage.get(price.securityId);

		if(entry) {
			entry.prices += 1;
		}
	}

	return usage;
};

/**
 * Says whether an ISIN is already recorded. It is the one field of a security that is unique, being what identifies the instrument.
 * @param query The ISIN and what to compare it against.
 * @param query.securities The securities already recorded.
 * @param query.isin The ISIN being entered.
 * @param query.exceptId The security being corrected, which is never a duplicate of itself.
 * @returns Whether the ISIN collides.
 */
export const isIsinTaken = ({ securities, isin, exceptId }: IsinQuery): boolean => {
	return securities.some((security) => {
		return security.id !== exceptId && isSameName(security.isin, isin);
	});
};

/**
 * Finds the security an ISIN or a ticker names, which is what the trade form searches as one is typed.
 * @param securities The securities already recorded.
 * @param text What was typed.
 * @returns The security it names, or undefined when it names none.
 */
export const findSecurityByIsinOrTicker = (securities: readonly Security[], text: string): Security | undefined => {
	const wanted = text.trim();

	if(wanted === '') {
		return undefined;
	}

	return securities.find((security) => {
		return isSameName(security.isin, wanted) || isSameName(security.ticker, wanted);
	});
};

/**
 * Keeps one security's prices, newest first — the opposite of every other table in the application.
 * @param prices Every price in the file.
 * @param securityId The security.
 * @returns Its price history, newest first.
 */
export const priceHistoryOf = (prices: readonly Price[], securityId: LedgerId): Price[] => {
	return prices.filter((price) => {
		return price.securityId === securityId;
	}).sort((first, second) => {
		return first.date < second.date ? 1 : -1;
	});
};

// The page the panel opens on and the one a written record lands back on when the history no longer holds it: the first, which
// is where the most recent records are
export const FIRST_PRICE_PAGE = FIRST_PAGE;

/**
 * How many pages a price history makes. An empty history still has one page, which is the page the empty state is shown on.
 * @param count How many records there are.
 * @returns The number of pages, never less than one.
 */
export const priceHistoryPageCount = (count: number): number => {
	return pageCountOf(count, PRICE_HISTORY_CONFIG.rowsPerPage);
};

/**
 * Takes one page out of a price history.
 * @param prices The security's price history, newest first.
 * @param page The page, counting from one.
 * @returns The records on that page.
 */
export const priceHistoryPage = (prices: readonly Price[], page: number): Price[] => {
	return pageOf(prices, page, PRICE_HISTORY_CONFIG.rowsPerPage);
};

/**
 * Which page a record sits on, which is how the panel follows a price that has just been written or moved.
 * @param prices The security's price history, newest first.
 * @param date The day the record sits on, a day being what identifies one.
 * @returns The page holding it, or the first page when the history does not hold that day.
 */
export const priceHistoryPageHolding = (prices: readonly Price[], date: IsoDate): number => {
	return pageHolding(prices, (price) => {
		return price.date === date;
	}, PRICE_HISTORY_CONFIG.rowsPerPage);
};

/**
 * Indexes the latest price of every security, which is the value every current figure in the application is computed from.
 * @param prices Every price in the file.
 * @returns The latest price per security, and no entry at all for a security that has none.
 */
export const indexLatestPrices = (prices: readonly Price[]): Map<LedgerId, Price> => {
	const latest = new Map<LedgerId, Price>();

	for(const price of prices) {
		const standing = latest.get(price.securityId);

		if(!standing || standing.date < price.date) {
			latest.set(price.securityId, price);
		}
	}

	return latest;
};

/**
 * Groups every security's prices, oldest first, which is what a line drawn over the years reads.
 * @param prices Every price in the file.
 * @returns One history per security that has been priced, oldest first, and no entry at all for a security that has none.
 */
export const indexPriceHistories = (prices: readonly Price[]): Map<LedgerId, Price[]> => {
	const histories = new Map<LedgerId, Price[]>();

	for(const price of prices) {
		const history = histories.get(price.securityId);

		if(history) {
			history.push(price);
		}
		else {
			histories.set(price.securityId, [ price ]);
		}
	}

	for(const history of histories.values()) {
		history.sort((first, second) => {
			return first.date < second.date ? -1 : 1;
		});
	}

	return histories;
};

/**
 * Finds the most recent price a security had on or before a day, which is what values a holding at a past date.
 *
 * **A security with a history but nothing dated that early has no price there**, and the caller falls back to cost — which is
 * the same thing it does for a security with no history at all, that having no price anywhere either ([§11.5]).
 * @param history One security's prices, oldest first.
 * @param date The day being asked about.
 * @returns The price in force on that day, or undefined where the history starts after it.
 */
export const priceOnOrBefore = (history: readonly Price[], date: IsoDate): Price | undefined => {
	for(let index = history.length - 1; index >= 0; index -= 1) {
		if(history[index].date <= date) {
			return history[index];
		}
	}

	return undefined;
};

/**
 * Finds what a security's given day holds, which is what the inline editor opens on and what a second price for that day replaces.
 * @param prices Every price in the file.
 * @param securityId The security.
 * @param date The day.
 * @returns The price that day holds, or undefined when it holds none.
 */
export const priceOnDay = (prices: readonly Price[], securityId: LedgerId, date: IsoDate): Price | undefined => {
	return prices.find((price) => {
		return price.securityId === securityId && price.date === date;
	});
};

/**
 * Writes a price into the history, replacing whatever its day already held — value and source alike.
 *
 * **Every edit a user makes sets the source to `manual`**, an edit to a fetched record's value and an edit to its date included,
 * so a figure somebody has corrected stops claiming to be the provider's.
 * @param prices Every price in the file.
 * @param price The price being recorded.
 * @returns The prices, with that day holding this one.
 */
export const writePrice = (prices: readonly Price[], price: Price): Price[] => {
	const kept = prices.filter((candidate) => {
		return candidate.securityId !== price.securityId || candidate.date !== price.date;
	});

	return [ ...kept, price ];
};

// The pair a price is keyed by in the file: one price per security per day, and the reader refuses a second for either
const toPriceKey = (securityId: LedgerId, date: IsoDate): string => {
	return `${securityId}\t${date}`;
};

/**
 * Indexes every price by the security and day it belongs to.
 *
 * **This is what makes a whole history cheap to read against.** Asking what each of four thousand days currently holds by
 * scanning the file's prices for each of them is the same work four thousand times over; asked of a map built once, it is four
 * thousand lookups.
 * @param prices Every price in the file.
 * @returns The prices, by security and day.
 */
export const indexPricesByDay = (prices: readonly Price[]): Map<string, Price> => {
	const byDay = new Map<string, Price>();

	for(const price of prices) {
		byDay.set(toPriceKey(price.securityId, price.date), price);
	}

	return byDay;
};

/**
 * Finds what a security's given day holds, out of an index rather than out of the file.
 * @param byDay The index.
 * @param securityId The security.
 * @param date The day.
 * @returns The price that day holds, or undefined when it holds none.
 */
export const priceOnDayIndexed = (byDay: ReadonlyMap<string, Price>, securityId: LedgerId, date: IsoDate): Price | undefined => {
	return byDay.get(toPriceKey(securityId, date));
};

/**
 * Writes many prices into the history at once, each replacing whatever its own day already held.
 *
 * **The same rule as one price, applied to thousands of them without the cost of doing it thousands of times**: writing a
 * confirmed history one record at a time would re-read the whole history for every day of it. The records are laid over an index
 * of what is there, so a pass costs one walk of the file and one of the pass.
 * @param prices Every price in the file.
 * @param records The prices being recorded, later ones winning where two name one day.
 * @returns The prices, with each of those days holding its record.
 */
export const writePrices = (prices: readonly Price[], records: readonly Price[]): Price[] => {
	if(records.length === 0) {
		return [ ...prices ];
	}

	const written = indexPricesByDay(prices);

	for(const record of records) {
		written.set(toPriceKey(record.securityId, record.date), record);
	}

	return [ ...written.values() ];
};

// Which of a security's records a clearing removes: every one of them, or only what a price pass wrote
export type PriceClearance = 'all' | 'fetched';

/**
 * Clears a security's price history in one go, all of it or only the records a price pass wrote.
 *
 * **This is the bulk of the delete a row menu does one record at a time**, and it exists because a pass asked under a `ticker` or
 * an `exchange` that names the wrong listing writes thousands of records in one press: undoing that a row at a time is not undoing
 * it. Clearing the fetched ones is what puts such a pass right, hand-typed figures being the ones no fetch can write again.
 * @param prices Every price in the file.
 * @param securityId The security whose history is being cleared.
 * @param scope Whether every record goes, or only the fetched ones.
 * @returns The prices, without the ones that were cleared. Every other security is untouched.
 */
export const clearPriceHistory = (prices: readonly Price[], securityId: LedgerId, scope: PriceClearance): Price[] => {
	return prices.filter((price) => {
		return price.securityId !== securityId || (scope === 'fetched' && price.source !== 'fetched');
	});
};

/**
 * Says whether a price has aged past the threshold the preferences hold.
 *
 * The age is measured against **the computer's own clock**, read at the moment the figure is computed, exactly as every other age
 * in the application is. A day with no price at all is not stale: there is no date to age, and the price cell has already said so.
 * @param date The day the price is as of.
 * @param stalenessDays How many days a price may be old before it is marked.
 * @returns Whether the date is older than the threshold.
 */
export const isPriceStale = (date: IsoDate, stalenessDays: number): boolean => {
	const parsed = DateUtils.fromStandardYearMonthDay(date);

	return parsed !== undefined && -DateUtils.dayOffsetFromToday(parsed) > stalenessDays;
};
