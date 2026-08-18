import { PRICES_CONFIG } from 'src/config/AppConfig';
import { MONEY_SCALES, roundHalfAwayFromZero } from 'src/logic/money/Money';
import type { ProviderQuote } from 'src/main/prices/PriceProvider';
import type { PriceQuoteRefusal } from 'src/types/PriceIpcTypes';
import type { IsoDate, TenThousandths } from 'src/types/LedgerTypes';

/**
 * The four refusals of the specification, applied to what came back before the user ever sees it.
 *
 * They are here rather than in the adapter because they are Spiccioli's rules and not the provider's, which is what makes them
 * testable without a network and the provider replaceable without them. **A quote that fails any of them is not offered and not
 * written**: the security appears among the ones that could not be fetched, with its reason named, and the price it already had
 * still stands.
 *
 * **The currency check is the one that has to be defended rather than assumed.** No record in the file carries a currency, so a
 * number arriving from outside carries no marking to say it is something else: a dollar quote written into a Price would go
 * straight into a holding's value, the breakdown, the chart and net worth, wrong by the exchange rate and invisible to every
 * check. So the currency the provider states is compared against EUR, **and a provider that states none at all is the same
 * refusal** — an unlabelled number is not evidence of anything.
 *
 * **A quote of zero or less is worth refusing separately** from the general rule that a price is more than zero, because a zero
 * is the one bad value that would look like ordinary missing data once written: a holding priced at zero reads as having no
 * price at all and values at nothing everywhere, so it would quietly take a real position out of net worth and leave check 3
 * describing the wrong problem.
 */

// The one currency the application has anywhere to record. Everything else is out of scope by the premise, not by omission.
export const ACCEPTED_CURRENCY = 'EUR';

// The single conversion from what a provider states to what a Price holds. It is a boundary of the same kind as the amount field,
// the import parser, the reader and the writer, and like them it happens exactly once.
const RATE_SCALE_FACTOR = 10 ** MONEY_SCALES.rate;

export type PriceQuoteReviewResult = {
	outcome: 'quoted';
	value: TenThousandths;
	date: IsoDate;
} | {
	outcome: 'refused';
	refusal: PriceQuoteRefusal;

	// Named only where naming it is what makes the refusal legible, which is the currency that was not EUR
	currency: string | null;
};

// Whatever a provider put in the field, cut to something a panel row and a log line can hold
const readCurrencyCode = (currency: string): string => {
	const code = currency.trim().toUpperCase();

	return code.length <= PRICES_CONFIG.maximumCurrencyCodeLength ? code : code.slice(0, PRICES_CONFIG.maximumCurrencyCodeLength);
};

/**
 * Decides whether a quote may be offered, and says why where it may not.
 * @param quote What the provider stated.
 * @param today The day the pass is being run on, which is what "dated in the future" is measured against.
 * @returns The quote at the scale a Price is stored in, or the refusal it fell to.
 */
export const reviewProviderQuote = (quote: ProviderQuote, today: IsoDate): PriceQuoteReviewResult => {
	if(quote.currency === null || quote.currency.trim() === '') {
		return { outcome: 'refused', refusal: 'no-currency', currency: null };
	}

	const currency = readCurrencyCode(quote.currency);

	if(currency !== ACCEPTED_CURRENCY) {
		return { outcome: 'refused', refusal: 'not-euro', currency };
	}

	// A day is compared as text, which for YYYY-MM-DD is the same comparison as by date and needs no parsing
	if(quote.date > today) {
		return { outcome: 'refused', refusal: 'future-date', currency: null };
	}

	const value = Number.isFinite(quote.price) ? roundHalfAwayFromZero(quote.price * RATE_SCALE_FACTOR) : 0;

	// A figure that rounds away to nothing at the fourth decimal is a zero once written, and is refused as one
	if(value <= 0) {
		return { outcome: 'refused', refusal: 'not-positive', currency: null };
	}

	return { outcome: 'quoted', value, date: quote.date };
};
