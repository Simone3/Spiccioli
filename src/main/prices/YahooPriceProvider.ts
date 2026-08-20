import { PRICES_CONFIG } from 'src/config/AppConfig';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { PriceListing, PriceProvider, PriceSpan, ProviderDay, ProviderQuoteResult } from 'src/main/prices/PriceProvider';
import type { Exchange, IsoDate } from 'src/types/LedgerTypes';

/**
 * The one place in Spiccioli that knows Yahoo Finance.
 *
 * It holds three things and nothing else knows any of them: **the suffix table** that turns Spiccioli's own exchange enum into
 * the symbol Yahoo lists a security under, **the "v8/finance/chart" request** made one listing at a time, and **the parse** of
 * what comes back.
 *
 * **One endpoint answers both spans**, which is why there is one request here and not two. Asked for the latest it is given
 * "range=1d" and read out of the "meta" beside the bars — the currency, the price and the moment it is as of — because that is
 * the live figure rather than the last daily bar. Asked for a span it is given "period1" and "period2" and read out of the bars
 * themselves: "timestamp" paired with "indicators.quote[0].close", **which is the split-adjusted close and is the one to use**,
 * the trades of a split are re-recorded at the quantity now held and so are stated in the same shares the adjusted series is.
 * **"adjclose" is not** — it deflates the past for dividends the ledger already holds as ordinary transactions, and would
 * understate every historical value by income that has been counted once already.
 *
 * **The suffixes never reach the file.** A security stores its `ticker` and one of the eighteen eurozone venues; ".MI" is
 * something this file appends on the way out and strips nothing on the way back, because nothing comes back that carries it.
 *
 * **The refusals of the specification are not here.** This adapter reports what the provider said, the figures a refusal will
 * fall on included, and the currency it stated them all in; "PriceQuoteReview" is what decides which of them may be written. That
 * is what keeps the refusals testable without a provider and the provider replaceable without them. **A day the provider simply
 * carried no figure for is this file's business** rather than a refusal, and is dropped here and counted.
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

// The endpoint takes no key and no account
const CHART_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// The latest: one daily bar, and the live figure in the meta beside it
const LATEST_QUERY = 'interval=1d&range=1d';

// A span: daily bars between two moments. "range=max" is not used and cannot be — Yahoo answers it at monthly granularity,
// while an explicit window keeps the daily one however far back it reaches.
const DAILY_INTERVAL = 'interval=1d';

// Yahoo turns away a request that names no browser at all. It identifies neither the machine nor the user, and it is the whole of
// what this adapter sends besides the symbol in the path.
const USER_AGENT = 'Mozilla/5.0';

// What Yahoo answers for a symbol it does not list. It is a "no quote" rather than a failure: the security simply is not carried.
const NOT_FOUND_STATUS = 404;

// Enough of the response to read quotes out of. Everything else Yahoo sends is ignored, and an absent field is an absent quote.
interface YahooChartMeta {
	currency?: unknown;
	regularMarketPrice?: unknown;
	regularMarketTime?: unknown;
	gmtoffset?: unknown;
}

// The one result of a response, which is where the meta and the bars both live
interface YahooChartResult {
	meta?: unknown;
	timestamp?: unknown;
	indicators?: unknown;
}

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
}>;

export interface CreateYahooPriceProviderOptions {

	// Injected so the adapter can be tested without a network. The application passes the runtime's own.
	fetchResource: FetchLike;

	// How long one request for the latest quote is given before it is abandoned
	timeoutMs?: number;

	// How long one request for a span is given, several thousand days being a longer answer than one figure
	historyTimeoutMs?: number;
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

// The one result of the one symbol asked about, which is where both the meta and the bars live
const readResult = (payload: unknown): YahooChartResult | undefined => {
	const chart = (payload as { chart?: { result?: unknown } } | null)?.chart;
	const results: unknown[] = Array.isArray(chart?.result) ? chart.result : [];
	const [ result ] = results;

	return typeof result === 'object' && result !== null ? result : undefined;
};

const readMeta = (payload: unknown): YahooChartMeta | undefined => {
	const meta = readResult(payload)?.meta;

	return typeof meta === 'object' && meta !== null ? meta : undefined;
};

// What the provider states every figure of one response in. A blank is a provider that stated nothing, which is a refusal of its own.
const readCurrency = (meta: YahooChartMeta): string | null => {
	return typeof meta.currency === 'string' && meta.currency.trim() !== '' ? meta.currency.trim() : null;
};

// A nonsensical offset is read as none rather than as a day somewhere else entirely
const readVenueOffset = (meta: YahooChartMeta): number => {
	const offset = readFiniteNumber(meta.gmtoffset) ?? 0;

	return Math.abs(offset) < SECONDS_PER_DAY ? offset : 0;
};

/**
 * Reads the live figure out of the meta, which is what the latest span asks for.
 * @param payload What the provider answered.
 * @returns The one day it carries, or that it carries none.
 */
const readLatest = (payload: unknown): ProviderQuoteResult => {
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

	return {
		outcome: 'quotes',
		days: [ { price, date: toExchangeDay(asOf, readVenueOffset(meta)) } ],
		blankDays: 0,
		currency: readCurrency(meta)
	};
};

// The closes of the one series the response carries. Split-adjusted, which is the series the file's own quantities are stated in.
const readCloses = (result: YahooChartResult): unknown[] => {
	const quotes = (result.indicators as { quote?: unknown } | undefined)?.quote;
	const closes = (Array.isArray(quotes) ? quotes[0] as { close?: unknown } | undefined : undefined)?.close;

	return Array.isArray(closes) ? closes : [];
};

/**
 * Reads the bars, which is what a span asks for.
 *
 * **A day the provider listed and carried no figure for is dropped and counted** — a holiday it lists anyway, a halt, a gap it
 * does not fill — rather than passed on as something the refusals have to recognise. **A day outside the span asked for is
 * dropped silently**: the window sent is deliberately a little wider at both ends, so that no venue's first or last day is lost
 * to its offset from UTC, and the days beyond it were never asked for.
 *
 * **One day holds one figure.** A response repeating a day keeps its last, the file having nowhere to put two prices for one
 * security and one date and its reader refusing a pair outright.
 * @param payload What the provider answered.
 * @param from The first day the span wanted.
 * @param to The last day the span wanted.
 * @returns The days it carries, oldest first, or that it carries none.
 */
const readSeries = (payload: unknown, from: IsoDate, to: IsoDate): ProviderQuoteResult => {
	const result = readResult(payload);
	const meta = readMeta(payload);

	if(!result || !meta) {
		return { outcome: 'no-quote' };
	}

	const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
	const closes = readCloses(result);
	const offset = readVenueOffset(meta);
	const byDay = new Map<IsoDate, number>();
	let blankDays = 0;

	for(let index = 0; index < timestamps.length; index += 1) {
		const at = readFiniteNumber(timestamps[index]);

		if(at === undefined) {
			continue;
		}

		const date = toExchangeDay(at, offset);

		if(date < from || date > to) {
			continue;
		}

		const close = readFiniteNumber(closes[index]);

		if(close === undefined) {
			blankDays += 1;
		}
		else {
			byDay.set(date, close);
		}
	}

	const days: ProviderDay[] = [ ...byDay ].map(([ date, price ]) => {
		return { date, price };
	}).sort((first, second) => {
		return first.date < second.date ? -1 : 1;
	});

	// Every day of the span having come back blank is the provider carrying nothing for this listing, which is what it amounts to
	return days.length === 0 ? { outcome: 'no-quote' } : { outcome: 'quotes', days, blankDays, currency: readCurrency(meta) };
};

/**
 * Builds the query one span is asked with.
 *
 * The window sent for a span starts a day before the first day wanted and ends a day after the last: a venue's own offset from
 * UTC decides which day a bar falls on, and neither end may be lost to it. What is actually kept is decided against the span
 * afterwards.
 * @param span The span.
 * @returns The query string, without its leading question mark.
 */
const toChartQuery = (span: PriceSpan): string => {
	if(span.kind === 'latest') {
		return LATEST_QUERY;
	}

	const from = Math.floor(Date.parse(`${span.from}T00:00:00Z`) / MILLIS_PER_SECOND) - SECONDS_PER_DAY;
	const until = Math.floor(Date.parse(`${span.to}T00:00:00Z`) / MILLIS_PER_SECOND) + SECONDS_PER_DAY;

	return `${DAILY_INTERVAL}&period1=${from}&period2=${until}`;
};

/**
 * Builds the provider the application runs with.
 * @param options How it reaches the network.
 * @param options.fetchResource What makes the request.
 * @param options.timeoutMs How long one request for the latest quote is given.
 * @param options.historyTimeoutMs How long one request for a span is given, a span being thousands of days rather than one.
 * @returns The provider.
 */
export const createYahooPriceProvider = ({
	fetchResource,
	timeoutMs = PRICES_CONFIG.requestTimeoutMs,
	historyTimeoutMs = PRICES_CONFIG.historyRequestTimeoutMs
}: CreateYahooPriceProviderOptions): PriceProvider => {
	return {
		fetchQuotes: async(listing: PriceListing, span: PriceSpan): Promise<ProviderQuoteResult> => {
			const symbol = toYahooSymbol(listing);

			try {
				const response = await fetchResource(`${CHART_ENDPOINT}${encodeURIComponent(symbol)}?${toChartQuery(span)}`, {
					headers: { accept: 'application/json', 'user-agent': USER_AGENT },
					signal: AbortSignal.timeout(span.kind === 'latest' ? timeoutMs : historyTimeoutMs)
				});

				if(response.status === NOT_FOUND_STATUS) {
					return { outcome: 'no-quote' };
				}

				if(!response.ok) {
					return { outcome: 'failed', message: `The provider answered ${response.status}.` };
				}

				const payload = await response.json();

				return span.kind === 'latest' ? readLatest(payload) : readSeries(payload, span.from, span.to);
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
