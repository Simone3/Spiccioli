import { PRICES_CONFIG } from 'src/config/AppConfig';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { PriceListing, PriceProvider, ProviderQuoteResult } from 'src/main/prices/PriceProvider';
import type { Exchange } from 'src/types/LedgerTypes';

/**
 * The one place in Spiccioli that knows Yahoo Finance.
 *
 * It holds three things and nothing else knows any of them: **the suffix table** that turns Spiccioli's own exchange enum into
 * the symbol Yahoo lists a security under, **the "v8/finance/chart" request** made one listing at a time, and **the parse** of
 * the three fields of its "meta" that a quote is made of — the currency, the price and the moment it is as of.
 *
 * **The suffixes never reach the file.** A security stores its `ticker` and one of the eighteen eurozone venues; ".MI" is
 * something this file appends on the way out and strips nothing on the way back, because nothing comes back that carries it.
 *
 * **The four refusals of the specification are not here.** This adapter reports what the provider said, refusals included as an
 * ordinary quote with its currency and its date; "PriceQuoteReview" is what decides whether that quote may be written. That is
 * what keeps the refusals testable without a provider and the provider replaceable without them.
 *
 * The name the screen shows beside the button is in the translation bundle, like every other word the user reads.
 */

// What Yahoo lists each of the eighteen eurozone venues of the domain model under
const EXCHANGE_SUFFIXES: Record<Exchange, string> = {
	milan: '.MI',
	xetra: '.DE',
	frankfurt: '.F',
	amsterdam: '.AS',
	paris: '.PA',
	brussels: '.BR',
	lisbon: '.LS',
	madrid: '.MC',
	vienna: '.VI',
	helsinki: '.HE',
	dublin: '.IR',
	athens: '.AT',
	stuttgart: '.SG',
	dusseldorf: '.DU',
	munich: '.MU',
	hamburg: '.HM',
	tallinn: '.TL',
	vilnius: '.VS'
};

const SECONDS_PER_DAY = 86400;

const MILLIS_PER_SECOND = 1000;

// The endpoint takes no key and no account, and the query says "the latest daily bar" — the meta beside it is what a quote is read from
const CHART_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';

const CHART_QUERY = '?interval=1d&range=1d';

// Yahoo turns away a request that names no browser at all. It identifies neither the machine nor the user, and it is the whole of
// what this adapter sends besides the symbol in the path.
const USER_AGENT = 'Mozilla/5.0';

// What Yahoo answers for a symbol it does not list. It is a "no quote" rather than a failure: the security simply is not carried.
const NOT_FOUND_STATUS = 404;

// Enough of the response to read a quote out of. Everything else Yahoo sends is ignored, and an absent field is an absent quote.
interface YahooChartMeta {
	currency?: unknown;
	regularMarketPrice?: unknown;
	regularMarketTime?: unknown;
	gmtoffset?: unknown;
}

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
}>;

export interface CreateYahooPriceProviderOptions {

	// Injected so the adapter can be tested without a network. The application passes the runtime's own.
	fetchResource: FetchLike;

	// How long one request is given before it is abandoned
	timeoutMs?: number;
}

/**
 * Builds the symbol Yahoo lists a listing under: the ticker as it is recorded, and the venue's suffix.
 * @param listing The listing.
 * @returns The symbol.
 */
export const toYahooSymbol = (listing: PriceListing): string => {
	return `${listing.ticker.trim().toUpperCase()}${EXCHANGE_SUFFIXES[listing.exchange]}`;
};

const readFiniteNumber = (value: unknown): number | undefined => {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

/**
 * Reads the day a quote belongs to out of the moment the provider states it at.
 *
 * The instant is an epoch second and the offset is the venue's own, so the two together give the day **on the exchange** —
 * which is the day the quote is for, and the only day a Price record could sensibly be filed under. There is no time and no time
 * zone in the file, so this is where both stop.
 * @param epochSeconds The moment the figure is as of.
 * @param offsetSeconds The venue's offset from UTC, as the provider states it. A provider that states none is read as UTC.
 * @returns The day, as YYYY-MM-DD.
 */
export const toExchangeDay = (epochSeconds: number, offsetSeconds: number): string => {
	const atVenue = new Date((epochSeconds + offsetSeconds) * MILLIS_PER_SECOND);

	return atVenue.toISOString().slice(0, 'YYYY-MM-DD'.length);
};

const readMeta = (payload: unknown): YahooChartMeta | undefined => {
	const chart = (payload as { chart?: { result?: unknown } } | null)?.chart;
	const results = Array.isArray(chart?.result) ? chart.result : undefined;
	const meta = (results?.[0] as { meta?: unknown } | undefined)?.meta;

	return typeof meta === 'object' && meta !== null ? meta : undefined;
};

const readQuote = (payload: unknown): ProviderQuoteResult => {
	const meta = readMeta(payload);

	if(!meta) {
		return { outcome: 'no-quote' };
	}

	const price = readFiniteNumber(meta.regularMarketPrice);
	const asOf = readFiniteNumber(meta.regularMarketTime);

	// A figure with no day to file it under is not a quote this application can record, and neither is a missing figure. Both are
	// the provider carrying nothing rather than the provider being wrong, so neither is one of the refusals.
	if(price === undefined || asOf === undefined) {
		return { outcome: 'no-quote' };
	}

	const offset = readFiniteNumber(meta.gmtoffset) ?? 0;

	return {
		outcome: 'quote',
		quote: {
			price,

			// A nonsensical offset is read as none rather than as a day somewhere else entirely
			date: toExchangeDay(asOf, Math.abs(offset) < SECONDS_PER_DAY ? offset : 0),
			currency: typeof meta.currency === 'string' && meta.currency.trim() !== '' ? meta.currency.trim() : null
		}
	};
};

/**
 * Builds the provider the application runs with.
 * @param options How it reaches the network.
 * @param options.fetchResource What makes the request.
 * @param options.timeoutMs How long one request is given.
 * @returns The provider.
 */
export const createYahooPriceProvider = ({ fetchResource, timeoutMs = PRICES_CONFIG.requestTimeoutMs }: CreateYahooPriceProviderOptions): PriceProvider => {
	return {
		fetchQuote: async(listing: PriceListing): Promise<ProviderQuoteResult> => {
			const symbol = toYahooSymbol(listing);

			try {
				const response = await fetchResource(`${CHART_ENDPOINT}${encodeURIComponent(symbol)}${CHART_QUERY}`, {
					headers: { accept: 'application/json', 'user-agent': USER_AGENT },
					signal: AbortSignal.timeout(timeoutMs)
				});

				if(response.status === NOT_FOUND_STATUS) {
					return { outcome: 'no-quote' };
				}

				if(!response.ok) {
					return { outcome: 'failed', message: `The provider answered ${response.status}.` };
				}

				return readQuote(await response.json());
			}
			catch(error) {
				return { outcome: 'failed', message: getErrorMessage(error) };
			}
		}

		// Yahoo states no reference date of its own for a pass: the moment each figure is as of is the day its own quote carries,
		// and there is no second date behind it. A provider that does state one implements "readReferenceDate" and the panel
		// grows the line without anything else changing.
	};
};
