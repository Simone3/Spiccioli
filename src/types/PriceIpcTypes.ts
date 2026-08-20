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
 *
 * **One thing is pushed the other way**, and it is the only thing that ever is: how far a pass has got. A pass over a whole file
 * asked day by day is slow enough that the screen has to say so while it runs, and a count of listings is the whole of what that
 * takes.
 */

// One security to ask about. The listing the provider is given is the "ticker" and the "exchange" and nothing else.
export interface PriceListingRequest {
	securityId: LedgerId;
	ticker: string;
	exchange: Exchange;

	// The first day wanted, which is the day after the security's most recent price or the day of its first purchase. Null asks
	// for the latest quote alone, which is both what the shortest pass asks of every security and what a security with no history
	// to build is asked for whichever pass this is.
	from: IsoDate | null;

	// The last day wanted: today where the position is open, and the day of the last sale where it is closed. Null wherever
	// "from" is null, a request for the latest quote having no window to bound.
	to: IsoDate | null;
}

// The four refusals of the specification, applied to what came back before the user ever sees it
export const PRICE_QUOTE_REFUSALS = [ 'future-date', 'not-positive', 'not-euro', 'no-currency' ] as const;

export type PriceQuoteRefusal = typeof PRICE_QUOTE_REFUSALS[number];

// One day that may be written, at the scale a Price is stored in
export interface QuotedDay {

	// Already at the scale a Price is stored in: the conversion from whatever the provider states happens once, in the pass
	value: TenThousandths;

	// The day the quote is for, which is the day the Price record would be filed under
	date: IsoDate;
}

export type PriceFetchOutcome = {
	outcome: 'quoted';
	securityId: LedgerId;

	// Oldest first, and never empty. One entry where the latest quote was asked for, and one per day of the span otherwise.
	days: QuotedDay[];

	// Days that came back and will not be written: the ones a refusal took down, and the ones carrying no figure at all
	droppedCount: number;
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

/**
 * How far a pass has got, pushed to the renderer as each listing is answered.
 *
 * **The answer travels with the count**, because the review is drawn while the pass runs and fills in row by row: a report that
 * said only how many had been asked would leave the screen to redraw itself whole at the end, which is the one thing the single
 * page is built to avoid.
 */
export interface PricePassProgress {
	done: number;
	total: number;

	// The listing just answered, so that the screen can name what it is waiting on. It is already the renderer's own.
	ticker: string;

	// What that listing came back with, read against the file by the renderer exactly as the finished pass's outcomes are
	outcome: PriceFetchOutcome;
}

export interface PricePassResult {

	// The moment the provider's figures are as of, where it states one. Null where it does not, and the panel says nothing.
	referenceDate: IsoDate | null;

	// One per listing asked about, in the order they were asked for
	outcomes: PriceFetchOutcome[];
}

// What the confirmation did, sent back only so that the log can say how a pass ended. A cancelled pass reports nothing written.
export interface PricesWrittenReport {
	writtenCount: number;

	// The span the records cover rather than the days themselves: a confirmed history is thousands of them, and a log line that
	// grew with the file would be unreadable long before it was useful. Null on both where nothing was written.
	firstDate: IsoDate | null;
	lastDate: IsoDate | null;
}

// What the preload publishes on "window.spiccioliPrices"
export interface SpiccioliPricesApi {
	updatePrices: (listings: PriceListingRequest[]) => Promise<PricePassResult>;
	reportPricesWritten: (report: PricesWrittenReport) => Promise<void>;

	// Abandons the running pass, which is what cancelling the modal does. The listing in flight is finished and thrown away, the
	// ones behind it are never asked for, and the result the renderer is still waiting on is dropped where it stands: a cancelled
	// pass ends at nothing.
	cancelPricePass: () => Promise<void>;

	// Listens for how far the running pass has got. What comes back removes the listener again, and the screen calls it when the
	// pass ends: nothing here outlives the press that started it.
	onPassProgress: (listener: (progress: PricePassProgress) => void) => () => void;
}
