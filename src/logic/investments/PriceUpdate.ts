import { compareNames } from 'src/logic/accounts/Accounts';
import { priceOnDay, sortSecurities } from 'src/logic/investments/Securities';
import type { IsoDate, LedgerId, Price, Security, TenThousandths } from 'src/types/LedgerTypes';
import type { PriceFetchOutcome, PriceListingRequest, PriceQuoteRefusal, PricePassResult } from 'src/types/PriceIpcTypes';

/**
 * Everything pure about a price pass: what is asked for, what came back read against the file, and what confirming would write.
 *
 * **A pass covers every security in the file, held or fully sold.** A position that is closed still has a history worth pricing
 * and there is no list to tick first, so what goes out is one listing per security and nothing narrows it.
 *
 * **Nothing here writes anything either.** It reports what would be written and over what — the value the day currently holds,
 * and whether that value was typed by hand or fetched — and the records it produces are handed to the document only after the
 * user has confirmed the panel. **Cancel and none of this is called.**
 */

// One security that got a quote: the value, the day it belongs to, and what that day currently holds
export interface PriceUpdateRow {
	security: Security;
	value: TenThousandths;
	date: IsoDate;

	// What the day holds today, or undefined where the day is new
	replaces: Price | undefined;
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

	// How many of the rows would replace a value, and how many of those were typed by hand — which is the part worth stating
	replacedCount: number;
	replacedManualCount: number;
}

/**
 * Builds what goes out: one listing per security in the file, in the order the screen shows them.
 *
 * The identity travels with each listing so that an answer can be matched back to the security it belongs to; **it goes no
 * further than the main process**, which asks the provider for the ticker and the exchange alone.
 * @param securities Every security in the file.
 * @returns One listing each, ordered by ticker.
 */
export const toPriceListings = (securities: readonly Security[]): PriceListingRequest[] => {
	return sortSecurities(securities).map((security) => {
		return {
			securityId: security.id,
			ticker: security.ticker,
			exchange: security.exchange
		};
	});
};

const readSecurity = (securities: ReadonlyMap<LedgerId, Security>, outcome: PriceFetchOutcome): Security | undefined => {
	return securities.get(outcome.securityId);
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

	for(const outcome of result.outcomes) {
		const security = readSecurity(securities, outcome);

		if(!security) {
			continue;
		}

		if(outcome.outcome === 'quoted') {
			rows.push({
				security,
				value: outcome.value,
				date: outcome.date,
				replaces: priceOnDay(prices, security.id, outcome.date)
			});
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

	const replaced = rows.filter((row) => {
		return row.replaces !== undefined;
	});
	const dates = new Set(rows.map((row) => {
		return row.date;
	}));

	return {
		referenceDate: result.referenceDate ?? undefined,
		rows,
		problems,
		commonDate: dates.size === 1 ? [ ...dates ][0] : undefined,
		replacedCount: replaced.length,
		replacedManualCount: replaced.filter((row) => {
			return row.replaces?.source === 'manual';
		}).length
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
	return rows.map((row) => {
		return {
			securityId: row.security.id,
			date: row.date,
			value: row.value,
			source: 'fetched' as const
		};
	});
};
