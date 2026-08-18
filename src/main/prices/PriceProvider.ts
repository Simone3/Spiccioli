import type { Exchange, IsoDate } from 'src/types/LedgerTypes';

/**
 * What everything above the adapter sees: a listing and a span in, and the days it carries or a reason out.
 *
 * **This is the whole of the provider's surface.** Nothing outside "src/main/prices" knows which provider answers, what it is
 * addressed by or what its response looks like, so replacing it is the adapter file and its tests and nothing else.
 *
 * **A listing is the whole of what leaves the machine** — a ticker and an exchange, and never the ISIN, an amount, a quantity or
 * an account. The exchange is Spiccioli's own enum of eurozone venues; whatever a provider spells it as is the adapter's business
 * and never reaches the file. **A span carries no more than a date**: how far back the history is wanted from.
 *
 * **The currency belongs to the answer and not to the day.** A provider states it once for everything it sends back, which is
 * what lets a whole series be refused on one reading of it, and what keeps a day down to a figure and the date it is for.
 */

export interface PriceListing {
	ticker: string;
	exchange: Exchange;
}

/**
 * How far back one request reaches.
 *
 * **"latest" is the pass that keeps a file current** and asks for one figure per security. **"since" is the pass that fills a
 * history in** and asks for every day from `from` through to today, that day being the one after the file's most recent price or
 * the security's first purchase.
 */
export type PriceSpan = {
	kind: 'latest';
} | {
	kind: 'since';
	from: IsoDate;
};

// One day the provider carries, before any of the refusals of the specification are applied to it
export interface ProviderDay {

	// As the provider states it, at whatever precision it uses. Narrowing it to the ten-thousandths a Price is stored in is a
	// boundary of Spiccioli's own and is not the adapter's.
	price: number;

	// The day the figure is for, read in the listing's own exchange time
	date: IsoDate;
}

export type ProviderQuoteResult = {
	outcome: 'quotes';

	// Oldest first, and never empty: a provider carrying the listing but no day of the span is a "no-quote" instead
	days: ProviderDay[];

	// Days of the span the provider listed and carried no figure for — a holiday it lists anyway, a halt, a gap it does not fill.
	// They are dropped here rather than passed on, and counted, because the panel says how many days a series lost and to what.
	blankDays: number;

	// What the provider says every one of them is stated in. Null is a provider that stated nothing, which is a refusal of its own.
	currency: string | null;
} | {

	// The provider does not carry this listing. It is not an error, and the security keeps the price it has.
	outcome: 'no-quote';
} | {

	// The request itself did not complete: no network, a refused connection, a timeout, an answer that was not the shape agreed
	outcome: 'failed';
	message: string;
};

export interface PriceProvider {
	/**
	 * Asks for the days the provider has for one listing over one span.
	 * It never throws: a request that did not complete comes back as a "failed" result with what went wrong.
	 */
	fetchQuotes: (listing: PriceListing, span: PriceSpan) => Promise<ProviderQuoteResult>;

	/**
	 * The moment the provider's own figures are as of, which is not necessarily the day any individual quote carries.
	 * **Only a provider that states one implements this**, and the review panel shows the line only where there is one.
	 */
	readReferenceDate?: () => IsoDate | undefined;
}
