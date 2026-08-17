import { DateUtils } from 'src/framework/utils/DateUtils';
import { compareNames, isSameName } from 'src/logic/accounts/Accounts';
import type { IsoDate, LedgerDocument, LedgerId, Price, Security } from 'src/types/LedgerTypes';

/**
 * Everything pure about securities and their prices: how they are ordered, what points at one, what makes an ISIN a duplicate,
 * and which price a day reads.
 *
 * **A security is ordered by its `ticker` wherever it appears** — the Holdings tab and the Securities tab alike — with the same
 * case- and accent-insensitive comparison every other name in the application is ordered by. **Its price history is the one table
 * in the application that reads newest first.**
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
