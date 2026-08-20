import { PRICES_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { reviewProviderQuotes } from 'src/main/prices/PriceQuoteReview';
import type { PriceProvider, PriceSpan } from 'src/main/prices/PriceProvider';
import type {
	PriceFetchOutcome,
	PriceListingRequest,
	PricePassProgress,
	PricePassResult,
	PricesWrittenReport
} from 'src/types/PriceIpcTypes';

/**
 * One press of *Update prices*, from end to end.
 *
 * **One request per listing the renderer sent**, which is one per security the user ticked, paced rather than fired at once, and
 * **each failing on its own without taking the pass down**: a security the provider has no quote for, one whose quote is refused
 * and one whose request never completed are three rows in the review, and the twelve securities around them are still asked
 * about.
 *
 * **What each request asks for is the listing's own.** A listing carrying no window wants the latest quote alone; one carrying a
 * window wants every day of it. The choice between the three spans is the user's and is made once for the whole pass, but it
 * reaches here already resolved to a span per security, a security with no history to build having nothing to ask for but the
 * latest quote whichever answer was given.
 *
 * **A pass says how far it has got as it goes**, one report per listing answered, carrying the answer with it: the review is
 * drawn while the pass runs and fills in row by row. It is the only thing the main process pushes to the renderer.
 *
 * **A pass can be abandoned and cannot be paused.** Asked to stop, it finishes the request in flight, asks for nothing further
 * and reports nothing more — and what it gathered goes nowhere, a cancelled pass ending at nothing.
 *
 * **Nothing here writes anything.** The pass reaches the network and reports what came back; the file is the renderer's, and a
 * Price record is written only after the user has confirmed the panel.
 *
 * **What the pass writes to the log** is the pass with its counts, one line per listing, and — once the renderer says so — what
 * the confirmation wrote. A line carries the same ticker and exchange that went to the provider and nothing else about the
 * holding: that is public market data, and it is exactly what already left the machine.
 */

export interface RunPricePassOptions {
	provider: PriceProvider;
	listings: readonly PriceListingRequest[];

	// Spaced rather than fired at once, so a file of forty securities is not forty simultaneous requests
	spacingMs?: number;

	// Injected so a test does not have to wait out the pacing
	delay?: (milliseconds: number) => Promise<void>;

	// Told how far the pass has got, once per listing answered. Absent where nobody is watching.
	onProgress?: (progress: PricePassProgress) => void;

	// Asked before each listing. A pass the user has abandoned finishes the request in flight, asks for nothing further and comes
	// back with what it happens to hold — which nobody reads: a cancelled pass ends at nothing.
	isCancelled?: () => boolean;
}

const sleep = (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
};

const truncateFailure = (message: string): string => {
	return message.length <= PRICES_CONFIG.maximumFailureMessageLength ?
		message :
		`${message.slice(0, PRICES_CONFIG.maximumFailureMessageLength)}…`;
};

// What one listing is asking for: the latest quote alone, or every day of the window it carries
const toSpan = (listing: PriceListingRequest): PriceSpan => {
	return listing.from === null || listing.to === null ?
		{ kind: 'latest' } :
		{ kind: 'window', from: listing.from, to: listing.to };
};

// One listing, asked about and read. The listing given to the provider is the ticker and the exchange: the identity the renderer
// sent to match the answer back with never goes any further than this function.
const fetchOne = async(provider: PriceProvider, listing: PriceListingRequest, today: string): Promise<PriceFetchOutcome> => {
	const span = toSpan(listing);
	const result = await provider.fetchQuotes({ ticker: listing.ticker, exchange: listing.exchange }, span);

	if(result.outcome === 'failed') {
		return { outcome: 'failed', securityId: listing.securityId, message: truncateFailure(result.message) };
	}

	if(result.outcome === 'no-quote') {
		return { outcome: 'no-quote', securityId: listing.securityId };
	}

	const reviewed = reviewProviderQuotes(result, today, span);

	if(reviewed.outcome === 'refused') {
		return { outcome: 'refused', securityId: listing.securityId, refusal: reviewed.refusal, currency: reviewed.currency };
	}

	// Every day of the span having fallen to a refusal or come back blank is the provider carrying nothing for this listing
	return reviewed.outcome === 'no-quote' ?
		{ outcome: 'no-quote', securityId: listing.securityId } :
		{ outcome: 'quoted', securityId: listing.securityId, days: reviewed.days, droppedCount: reviewed.droppedCount };
};

const logListing = (listing: PriceListingRequest, outcome: PriceFetchOutcome): void => {
	appLogger.debug('Asked the price provider for a listing', {
		type: 'prices.listing',
		ticker: listing.ticker,
		exchange: listing.exchange,
		outcome: outcome.outcome,
		days: outcome.outcome === 'quoted' ? outcome.days.length : undefined,
		dropped: outcome.outcome === 'quoted' ? outcome.droppedCount : undefined,

		// The newest day it carries, which for the shorter pass is the whole of what came back
		date: outcome.outcome === 'quoted' ? outcome.days[outcome.days.length - 1].date : undefined,
		refusal: outcome.outcome === 'refused' ? outcome.refusal : undefined,
		currency: outcome.outcome === 'refused' ? outcome.currency ?? undefined : undefined,
		message: outcome.outcome === 'failed' ? outcome.message : undefined
	});
};

// Every day the pass gathered, which for a span is what confirming would write
const countDays = (outcomes: readonly PriceFetchOutcome[]): number => {
	return outcomes.reduce((total, outcome) => {
		return outcome.outcome === 'quoted' ? total + outcome.days.length : total;
	}, 0);
};

const countOutcomes = (outcomes: readonly PriceFetchOutcome[], wanted: PriceFetchOutcome['outcome']): number => {
	return outcomes.filter((outcome) => {
		return outcome.outcome === wanted;
	}).length;
};

/**
 * Runs the pass.
 * @param options What is asked about and who is asked.
 * @param options.provider The provider.
 * @param options.listings One entry per security in the file, held or fully sold.
 * @param options.spacingMs How long the pass waits between requests.
 * @param options.delay What the waiting is done with.
 * @param options.onProgress Told how far the pass has got, once per listing answered.
 * @param options.isCancelled Asked before each listing, and again before its answer is reported.
 * @returns What came back, one outcome per listing, and the provider's reference date where it states one.
 */
export const runPricePass = async({
	provider,
	listings,
	spacingMs = PRICES_CONFIG.requestSpacingMs,
	delay = sleep,
	onProgress,
	isCancelled
}: RunPricePassOptions): Promise<PricePassResult> => {
	const today = DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());
	const outcomes: PriceFetchOutcome[] = [];

	appLogger.info('Starting a price pass', {
		type: 'prices.pass',
		stage: 'start',
		listings: listings.length,

		// How many of them are asking for a span rather than for the latest quote alone
		spans: listings.filter((listing) => {
			return listing.from !== null;
		}).length
	});

	let cancelled = false;

	for(const listing of listings) {
		if(isCancelled?.()) {
			cancelled = true;

			break;
		}

		if(outcomes.length > 0) {
			await delay(spacingMs);
		}

		const outcome = await fetchOne(provider, listing, today);

		logListing(listing, outcome);
		outcomes.push(outcome);

		// The request in flight when the user cancelled is finished and then dropped: reporting it would draw a row into a modal
		// that has already closed
		if(isCancelled?.()) {
			cancelled = true;

			break;
		}

		onProgress?.({ done: outcomes.length, total: listings.length, ticker: listing.ticker, outcome });
	}

	appLogger.info(cancelled ? 'Abandoned a price pass' : 'Finished a price pass', {
		type: 'prices.pass',
		stage: cancelled ? 'cancelled' : 'end',
		listings: listings.length,
		quoted: countOutcomes(outcomes, 'quoted'),
		noQuote: countOutcomes(outcomes, 'no-quote'),
		refused: countOutcomes(outcomes, 'refused'),
		failed: countOutcomes(outcomes, 'failed'),
		days: countDays(outcomes)
	});

	return {
		referenceDate: provider.readReferenceDate?.() ?? null,
		outcomes
	};
};

/**
 * Writes what the confirmation did into the log.
 *
 * **A cancelled pass reports a count of nothing**: the specification leaves no trace of one in *the ledger*, and the log still
 * says the pass happened and ended.
 *
 * **The span rather than the days.** A confirmed history is thousands of records, and a line that listed every one of them would
 * be unreadable long before it was useful.
 * @param report How many records were written and the span they cover.
 */
export const logPricesWritten = (report: PricesWrittenReport): void => {
	appLogger.info('A price pass was confirmed', {
		type: 'prices.written',
		written: report.writtenCount,
		from: report.firstDate ?? undefined,
		to: report.lastDate ?? undefined
	});
};
