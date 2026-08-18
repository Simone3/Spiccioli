import type { Exchange, IsoDate, LedgerId, TenThousandths } from 'src/types/LedgerTypes';

/**
 * What crosses the bridge for a price pass.
 *
 * The split is the same one storage keeps: **the renderer holds the model and the main process reaches the network**, so what
 * goes out is a listing and what comes back is a quote or a reason. Nothing here carries a holding, an amount, a quantity or an
 * account, and **the identity that goes out never reaches the provider** — it is how the renderer matches an answer back to a
 * security of its own, and the pass strips it before the adapter is called.
 *
 * **Nothing is written by any of this.** The renderer puts what came back to the user, and a confirmed pass writes Price records
 * the ordinary way, through the document it already holds.
 */

// One security to ask about. The listing the provider is given is the "ticker" and the "exchange" and nothing else.
export interface PriceListingRequest {
	securityId: LedgerId;
	ticker: string;
	exchange: Exchange;
}

// The four refusals of the specification, applied to what came back before the user ever sees it
export const PRICE_QUOTE_REFUSALS = [ 'future-date', 'not-positive', 'not-euro', 'no-currency' ] as const;

export type PriceQuoteRefusal = typeof PRICE_QUOTE_REFUSALS[number];

export type PriceFetchOutcome = {
	outcome: 'quoted';
	securityId: LedgerId;

	// Already at the scale a Price is stored in: the conversion from whatever the provider states happens once, in the pass
	value: TenThousandths;

	// The day the quote is for, which is the day the Price record would be filed under
	date: IsoDate;
} | {

	// The provider does not carry this listing. Not an error: the security keeps the price it has.
	outcome: 'no-quote';
	securityId: LedgerId;
} | {
	outcome: 'refused';
	securityId: LedgerId;
	refusal: PriceQuoteRefusal;

	// The currency the provider stated, where naming it is what makes the refusal legible. Null on the other three.
	currency: string | null;
} | {

	// The request did not complete at all
	outcome: 'failed';
	securityId: LedgerId;
	message: string;
};

export interface PricePassResult {

	// The moment the provider's figures are as of, where it states one. Null where it does not, and the panel says nothing.
	referenceDate: IsoDate | null;

	// One per listing asked about, in the order they were asked for
	outcomes: PriceFetchOutcome[];
}

// What the confirmation did, sent back only so that the log can say how a pass ended. A cancelled pass reports nothing written.
export interface PricesWrittenReport {
	writtenCount: number;
	dates: IsoDate[];
}

// What the preload publishes on "window.spiccioliPrices"
export interface SpiccioliPricesApi {
	updatePrices: (listings: PriceListingRequest[]) => Promise<PricePassResult>;
	reportPricesWritten: (report: PricesWrittenReport) => Promise<void>;
}
