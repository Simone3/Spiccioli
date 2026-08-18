import { PRICES_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { reviewProviderQuote } from 'src/main/prices/PriceQuoteReview';
import type { PriceProvider } from 'src/main/prices/PriceProvider';
import type { PriceFetchOutcome, PriceListingRequest, PricePassResult, PricesWrittenReport } from 'src/types/PriceIpcTypes';

/**
 * One press of *Update prices*, from end to end.
 *
 * **One request per security in the file, held or fully sold**, paced rather than fired at once, and **each failing on its own
 * without taking the pass down**: a security the provider has no quote for, one whose quote is refused and one whose request
 * never completed are three lines in the review panel, and the twelve securities around them are still asked about.
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

// One listing, asked about and read. The listing given to the provider is the ticker and the exchange: the identity the renderer
// sent to match the answer back with never goes any further than this function.
const fetchOne = async(provider: PriceProvider, listing: PriceListingRequest, today: string): Promise<PriceFetchOutcome> => {
	const result = await provider.fetchQuote({ ticker: listing.ticker, exchange: listing.exchange });

	if(result.outcome === 'failed') {
		return { outcome: 'failed', securityId: listing.securityId, message: truncateFailure(result.message) };
	}

	if(result.outcome === 'no-quote') {
		return { outcome: 'no-quote', securityId: listing.securityId };
	}

	const reviewed = reviewProviderQuote(result.quote, today);

	return reviewed.outcome === 'quoted' ?
		{ outcome: 'quoted', securityId: listing.securityId, value: reviewed.value, date: reviewed.date } :
		{ outcome: 'refused', securityId: listing.securityId, refusal: reviewed.refusal, currency: reviewed.currency };
};

const logListing = (listing: PriceListingRequest, outcome: PriceFetchOutcome): void => {
	appLogger.debug('Asked the price provider for a listing', {
		type: 'prices.listing',
		ticker: listing.ticker,
		exchange: listing.exchange,
		outcome: outcome.outcome,
		value: outcome.outcome === 'quoted' ? outcome.value : undefined,
		date: outcome.outcome === 'quoted' ? outcome.date : undefined,
		refusal: outcome.outcome === 'refused' ? outcome.refusal : undefined,
		currency: outcome.outcome === 'refused' ? outcome.currency ?? undefined : undefined,
		message: outcome.outcome === 'failed' ? outcome.message : undefined
	});
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
 * @returns What came back, one outcome per listing, and the provider's reference date where it states one.
 */
export const runPricePass = async({
	provider,
	listings,
	spacingMs = PRICES_CONFIG.requestSpacingMs,
	delay = sleep
}: RunPricePassOptions): Promise<PricePassResult> => {
	const today = DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());
	const outcomes: PriceFetchOutcome[] = [];

	appLogger.info('Starting a price pass', {
		type: 'prices.pass',
		stage: 'start',
		listings: listings.length
	});

	for(const listing of listings) {
		if(outcomes.length > 0) {
			await delay(spacingMs);
		}

		const outcome = await fetchOne(provider, listing, today);

		logListing(listing, outcome);
		outcomes.push(outcome);
	}

	appLogger.info('Finished a price pass', {
		type: 'prices.pass',
		stage: 'end',
		listings: listings.length,
		quoted: countOutcomes(outcomes, 'quoted'),
		noQuote: countOutcomes(outcomes, 'no-quote'),
		refused: countOutcomes(outcomes, 'refused'),
		failed: countOutcomes(outcomes, 'failed')
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
 * @param report How many records were written and for which days.
 */
export const logPricesWritten = (report: PricesWrittenReport): void => {
	appLogger.info('A price pass was confirmed', {
		type: 'prices.written',
		written: report.writtenCount,
		dates: report.dates
	});
};
