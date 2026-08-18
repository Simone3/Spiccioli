import { PRICES_CONFIG } from 'src/config/AppConfig';
import { MONEY_SCALES, roundHalfAwayFromZero } from 'src/logic/money/Money';
import type { PriceSpan, ProviderDay } from 'src/main/prices/PriceProvider';
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
 * **A refusal falls where the thing it reads falls.** The currency is stated once for everything a response carries, so it
 * refuses the whole of it — one quote or four thousand days alike. **The date and the figure are each a day's own**, so within a
 * span they take that day down and leave the rest standing: a handful of bad days in ten years of them is not a reason to throw
 * the ten years away, and the panel says how many were lost instead. **A span every day of which was dropped is a listing the
 * provider had no quote for**, which is what it amounts to, and it is reported as one.
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

	// Oldest first, and never empty. Every one of them is already at the scale a Price is stored in.
	days: ReviewedDay[];

	// Days the response carried that will not be written: the ones a refusal took down, and the ones it carried no figure for
	droppedCount: number;
} | {
	outcome: 'refused';
	refusal: PriceQuoteRefusal;

	// Named only where naming it is what makes the refusal legible, which is the currency that was not EUR
	currency: string | null;
} | {

	// Every day of the span fell to one of the two above, which leaves nothing to offer and nothing to name
	outcome: 'no-quote';
};

// One day that may be written, at the scale a Price is stored in
export interface ReviewedDay {
	value: TenThousandths;
	date: IsoDate;
}

// Whatever a provider put in the field, cut to something a panel row and a log line can hold
const readCurrencyCode = (currency: string): string => {
	const code = currency.trim().toUpperCase();

	return code.length <= PRICES_CONFIG.maximumCurrencyCodeLength ? code : code.slice(0, PRICES_CONFIG.maximumCurrencyCodeLength);
};

// What one day fell to, where it fell to anything. The two that are a day's own are the only ones reachable from here.
type DayRefusal = 'future-date' | 'not-positive';

// A day is compared as text, which for YYYY-MM-DD is the same comparison as by date and needs no parsing
const reviewDay = (day: ProviderDay, today: IsoDate): ReviewedDay | DayRefusal => {
	if(day.date > today) {
		return 'future-date';
	}

	const value = Number.isFinite(day.price) ? roundHalfAwayFromZero(day.price * RATE_SCALE_FACTOR) : 0;

	// A figure that rounds away to nothing at the fourth decimal is a zero once written, and is refused as one
	return value <= 0 ? 'not-positive' : { value, date: day.date };
};

export interface ProviderResponseToReview {
	days: readonly ProviderDay[];

	// Days the provider listed and carried no figure for. They are dropped like a refused one and counted with them.
	blankDays: number;

	currency: string | null;
}

/**
 * Decides which of the days that came back may be offered, and says why where none of them may.
 *
 * **The span decides where a bad day lands.** A pass asking for the latest quote has one day to report on, so a day that fails
 * is the security failing and is named as such — which is what the specification says a single quote does. **A pass asking for a
 * span reports on thousands**, so a day that fails is a day dropped and counted, and only a span that loses every one of them is
 * reported as carrying nothing.
 * @param response What the provider stated, and what it stated it in.
 * @param today The day the pass is being run on, which is what "dated in the future" is measured against.
 * @param span Which of the two passes this is.
 * @returns The days at the scale a Price is stored in, or the refusal the whole of it fell to.
 */
export const reviewProviderQuotes = (response: ProviderResponseToReview, today: IsoDate, span: PriceSpan): PriceQuoteReviewResult => {
	if(response.currency === null || response.currency.trim() === '') {
		return { outcome: 'refused', refusal: 'no-currency', currency: null };
	}

	const currency = readCurrencyCode(response.currency);

	if(currency !== ACCEPTED_CURRENCY) {
		return { outcome: 'refused', refusal: 'not-euro', currency };
	}

	const days: ReviewedDay[] = [];
	let firstRefusal: DayRefusal | undefined;

	for(const day of response.days) {
		const reviewed = reviewDay(day, today);

		if(typeof reviewed === 'string') {
			firstRefusal = firstRefusal ?? reviewed;
		}
		else {
			days.push(reviewed);
		}
	}

	// One quote that fell to a refusal is the security falling to it, named. A span with nothing left carries nothing.
	if(days.length === 0) {
		return span.kind === 'latest' && firstRefusal !== undefined ?
			{ outcome: 'refused', refusal: firstRefusal, currency: null } :
			{ outcome: 'no-quote' };
	}

	return { outcome: 'quoted', days, droppedCount: response.blankDays + (response.days.length - days.length) };
};
