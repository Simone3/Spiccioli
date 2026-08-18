import type { Exchange, IsoDate } from 'src/types/LedgerTypes';

/**
 * What everything above the adapter sees: a listing in, and a quote or a reason out.
 *
 * **This is the whole of the provider's surface.** Nothing outside "src/main/prices" knows which provider answers, what it is
 * addressed by or what its response looks like, so replacing it is the adapter file and its tests and nothing else.
 *
 * **A listing is the whole of what leaves the machine** — a ticker and an exchange, and never the ISIN, an amount, a quantity or
 * an account. The exchange is Spiccioli's own enum of eurozone venues; whatever a provider spells it as is the adapter's business
 * and never reaches the file.
 */

export interface PriceListing {
	ticker: string;
	exchange: Exchange;
}

// What a provider states about one listing, before any of the refusals of the specification are applied to it
export interface ProviderQuote {

	// As the provider states it, at whatever precision it uses. Narrowing it to the ten-thousandths a Price is stored in is a
	// boundary of Spiccioli's own and is not the adapter's.
	price: number;

	// The day the quote is for, read in the listing's own exchange time
	date: IsoDate;

	// What the provider says the quote is stated in. Null is a provider that stated nothing, which is a refusal of its own.
	currency: string | null;
}

export type ProviderQuoteResult = {
	outcome: 'quote';
	quote: ProviderQuote;
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
	 * Asks for the latest quote the provider has for one listing.
	 * It never throws: a request that did not complete comes back as a "failed" result with what went wrong.
	 */
	fetchQuote: (listing: PriceListing) => Promise<ProviderQuoteResult>;

	/**
	 * The moment the provider's own figures are as of, which is not necessarily the day any individual quote carries.
	 * **Only a provider that states one implements this**, and the review panel shows the line only where there is one.
	 */
	readReferenceDate?: () => IsoDate | undefined;
}
