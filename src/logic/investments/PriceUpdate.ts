import { indexPricesByDay, isPriceStale, priceOnDayIndexed, sortSecurities } from 'src/logic/investments/Securities';
import { DateUtils } from 'src/framework/utils/DateUtils';
import type { SecurityPosition } from 'src/logic/investments/Holdings';
import type { IsoDate, LedgerId, Price, Security, TenThousandths, Trade } from 'src/types/LedgerTypes';
import type {
	PriceFetchOutcome,
	PriceListingRequest,
	PriceQuoteRefusal,
	QuotedDay
} from 'src/types/PriceIpcTypes';

/**
 * Everything pure about a price pass: what the modal offers to ask for, what came back read against the file, and what
 * confirming would write.
 *
 * **A pass covers the securities the user ticked**, which the first page of the modal opens with set to the ones holding an open
 * position. Every security in the file is offered, held or fully sold, and nothing about the choice is remembered afterwards.
 *
 * **What differs per security is the window it is asked over**, and that is worked out here: from the day after its most recent
 * price, or from its first purchase, depending on the span; to today where the position is open and to the day of its last sale
 * where it is closed. A security with no purchase at all has no history to build and is asked for the latest quote alone,
 * whichever span was chosen.
 *
 * **Nothing here writes anything.** It reports what would be written and over what — the days the file holds nothing for, the
 * days holding a different value, and the days already holding exactly what came back — and the records it produces are handed to
 * the document only after the user has confirmed. **Cancel and none of this is called.**
 */

/**
 * Which of the three spans is being run, chosen once and applied to every ticked security.
 *
 * **`latest`** asks each security for the one figure the provider has now, whatever day it belongs to. **`since-last`** asks from
 * the day after the file's most recent price for it. **`whole-history`** asks from its first purchase, whatever prices it
 * already holds.
 */
export type PricePassSpan = 'latest' | 'since-last' | 'whole-history';

export const PRICE_PASS_SPANS: readonly PricePassSpan[] = [ 'latest', 'since-last', 'whole-history' ];

/** One security as the first page lists it: what the file holds for it, and what the pass would ask about it. */
export interface PriceListingPlan {
	security: Security;

	// The most recent price in the file, which is what the row states and what "since-last" starts after
	lastPrice: Price | undefined;

	// Whether the security still holds a position, which decides both the default tick and where its window ends
	isHeld: boolean;

	// The window the pass would ask over, both null where the latest quote is all there is to ask for
	from: IsoDate | null;
	to: IsoDate | null;

	// Calendar days the window covers, both ends included. Zero where there is no window.
	dayCount: number;
}

/** Which securities a selector ticks. Each sets the whole selection; a tick changed by hand afterwards simply stands. */
export type PriceSelectionKind = 'all' | 'none' | 'held' | 'never-priced' | 'stale';

/** One day that would land on a day already holding a different value. */
export interface PriceReplacement {
	date: IsoDate;
	value: TenThousandths;

	// What that day holds today, which is what confirming takes away
	previous: Price;
}

/** One security that got a quote: its newest day, and what writing the whole series would do to the file. */
export interface PriceUpdateRow {
	security: Security;

	// The newest day that came back, which is the whole of what came back where the latest quote was asked for
	value: TenThousandths;
	date: IsoDate;

	// Every day that came back, oldest first
	days: QuotedDay[];

	// The days confirming writes: the new ones and the ones landing on a different value, and never an unchanged day
	writes: QuotedDay[];

	// Days the file holds no price at all for
	newCount: number;

	// The days that would land on a different value, which are the only writes that take something away
	replacements: PriceReplacement[];

	// How many of those replace a value that was typed by hand
	replacesManualCount: number;

	// Days already holding exactly what came back. They are not written, and a manual record among them stays manual.
	unchangedCount: number;

	// Days that came back and will not be written: the ones a refusal took down, and the ones carrying no figure at all
	droppedCount: number;
}

/** One security nothing will be written for. It keeps the price it has, whichever of the three this is. */
export type PriceUpdateProblem = {
	security: Security;
} & ({
	reason: 'no-quote';
} | {
	reason: 'refused';
	refusal: PriceQuoteRefusal;
	currency: string | null;
} | {
	reason: 'failed';
	message: string;
});

/**
 * What one row of the review is showing.
 *
 * **Every security in the file has one**, the ones that were never ticked included, so that the page accounts for all of them
 * rather than quietly listing a subset. The three states before an answer are what the page shows while the pass runs.
 */
export type PriceUpdateEntry = {
	security: Security;
} & ({
	state: 'not-asked';
} | {
	state: 'queued';
} | {

	// The listing the pass is waiting on. What it is asking for is on the plan the first page built, so the row does not repeat it.
	state: 'asking';
} | {
	state: 'quoted';
	row: PriceUpdateRow;
} | {
	state: 'problem';
	problem: PriceUpdateProblem;

	// Whether asking again could come back with something else, which only an outright failure can
	retryable: boolean;
});

export interface PriceUpdateReview {

	// The moment the provider's figures are as of, where it states one at all
	referenceDate: IsoDate | undefined;

	// One per security in the file, ordered by ticker: the order the first page listed them in, unmoved
	entries: PriceUpdateEntry[];

	// The securities asking again could come back differently for, which is every one whose request did not complete
	retryableIds: LedgerId[];
}

/** What confirming a set of rows would do to the file, which is what the review totals in one line. */
export interface PriceWriteSummary {
	writeCount: number;
	securityCount: number;
	replacedCount: number;
	replacedManualCount: number;
	unchangedCount: number;
	droppedCount: number;
}

// The newest day a security holds a price for, where it holds any
const lastPriceOf = (prices: readonly Price[], securityId: LedgerId): Price | undefined => {
	return prices.reduce<Price | undefined>((latest, price) => {
		return price.securityId === securityId && (latest === undefined || price.date > latest.date) ? price : latest;
	}, undefined);
};

// The day a security was first bought on, which is the earliest day it could sensibly carry a price for
const firstPurchasedDay = (trades: readonly Trade[], securityId: LedgerId): IsoDate | undefined => {
	return trades.reduce<IsoDate | undefined>((earliest, trade) => {
		const wanted = trade.securityId === securityId && trade.kind === 'purchase';

		return wanted && (earliest === undefined || trade.date < earliest) ? trade.date : earliest;
	}, undefined);
};

// The day a security was last sold on, which is where the window of a closed position ends
const lastSoldDay = (trades: readonly Trade[], securityId: LedgerId): IsoDate | undefined => {
	return trades.reduce<IsoDate | undefined>((latest, trade) => {
		const wanted = trade.securityId === securityId && trade.kind === 'sale';

		return wanted && (latest === undefined || trade.date > latest) ? trade.date : latest;
	}, undefined);
};

const dayAfter = (date: IsoDate): IsoDate => {
	const parsed = DateUtils.fromStandardYearMonthDay(date);

	return parsed === undefined ? date : DateUtils.toStandardYearMonthDay(DateUtils.addDays(parsed, 1));
};

// Both ends included, so a window of one day counts as one
const daysBetween = (from: IsoDate, to: IsoDate): number => {
	const first = DateUtils.fromStandardYearMonthDay(from);
	const last = DateUtils.fromStandardYearMonthDay(to);

	return first === undefined || last === undefined ? 0 : DateUtils.dayDifference(first, last) + 1;
};

/**
 * Works out the window one security is asked over.
 *
 * **Where it begins** is the span's answer: the day after its most recent price, or the day of its first purchase. A security
 * with no purchase at all has no history to begin one from and is asked for the latest quote instead, whichever span this is.
 *
 * **Where it ends** is the position: today while one is open, and the day of the last sale once it is closed — no figure the
 * application draws needs a price for a day after a position ended.
 *
 * **It never begins after it ends.** A security priced past the end of its window would otherwise be asked for a span containing
 * nothing and be reported as one the provider carries no quote for, which is not what happened to it. Asked for that one day
 * instead, it comes back holding what the file already holds and writes nothing.
 * @param options What the window is worked out from.
 * @param options.securityId The security.
 * @param options.span Which of the three spans is being run.
 * @param options.lastPrice The most recent price in the file for it, where it holds one.
 * @param options.isHeld Whether it still holds a position.
 * @param options.trades Every trade in the file.
 * @param options.today The day the pass is being run on.
 * @returns The window, both ends null where the latest quote is all there is to ask for.
 */
export const toListingWindow = ({
	securityId,
	span,
	lastPrice,
	isHeld,
	trades,
	today
}: {
	securityId: LedgerId;
	span: PricePassSpan;
	lastPrice: Price | undefined;
	isHeld: boolean;
	trades: readonly Trade[];
	today: IsoDate;
}): { from: IsoDate | null; to: IsoDate | null } => {
	const purchased = firstPurchasedDay(trades, securityId);

	if(span === 'latest' || purchased === undefined) {
		return { from: null, to: null };
	}

	const sold = isHeld ? undefined : lastSoldDay(trades, securityId);
	const to = sold === undefined || sold > today ? today : sold;
	const from = span === 'whole-history' || lastPrice === undefined ? purchased : dayAfter(lastPrice.date);

	return { from: from > to ? to : from, to };
};

/**
 * Builds what the first page lists: every security in the file, in the order the screen shows them, with what the file holds for
 * it and what the pass would ask about it.
 *
 * **The plan is rebuilt whenever the span changes**, which is what makes the column of first days follow the choice rather than
 * describe it.
 * @param options What the plans are built from.
 * @param options.securities Every security in the file.
 * @param options.span Which of the three spans is being run.
 * @param options.prices Every price in the file, which is what says where a history left off.
 * @param options.trades Every trade in the file, which is what says where one could begin and where it ends.
 * @param options.positions What each security still holds, which decides the default tick and where a window ends.
 * @param options.today The day the pass is being run on.
 * @returns One plan each, ordered by ticker.
 */
export const planPricePass = ({
	securities,
	span,
	prices,
	trades,
	positions,
	today
}: {
	securities: readonly Security[];
	span: PricePassSpan;
	prices: readonly Price[];
	trades: readonly Trade[];
	positions: ReadonlyMap<LedgerId, SecurityPosition>;
	today: IsoDate;
}): PriceListingPlan[] => {
	return sortSecurities(securities).map((security) => {
		const position = positions.get(security.id);
		const isHeld = position !== undefined && (position.quantity > 0 || position.oversold);
		const lastPrice = lastPriceOf(prices, security.id);
		const { from, to } = toListingWindow({ securityId: security.id, span, lastPrice, isHeld, trades, today });

		return {
			security,
			lastPrice,
			isHeld,
			from,
			to,
			dayCount: from === null || to === null ? 0 : daysBetween(from, to)
		};
	});
};

/**
 * Builds what goes out: one listing per ticked security, in the order the page lists them.
 *
 * The identity travels with each listing so that an answer can be matched back to the security it belongs to; **it goes no
 * further than the main process**, which asks the provider for the ticker and the exchange alone. **The window travels with it
 * too**, and is the only other thing a listing carries.
 * @param plans What the first page listed.
 * @param selected The securities that are ticked.
 * @returns One listing each, ordered by ticker.
 */
export const toPriceListings = (plans: readonly PriceListingPlan[], selected: ReadonlySet<LedgerId>): PriceListingRequest[] => {
	return plans.filter((plan) => {
		return selected.has(plan.security.id);
	}).map((plan) => {
		return {
			securityId: plan.security.id,
			ticker: plan.security.ticker,
			exchange: plan.security.exchange,
			from: plan.from,
			to: plan.to
		};
	});
};

/**
 * Which securities a selector ticks.
 *
 * **Stale means what check 3 means** — a price older than the preference allows — and a security that has never been priced is
 * not stale but has its own selector, the two being different states worth reaching separately.
 * @param plans What the first page listed.
 * @param kind The selector pressed.
 * @param stalenessDays What the preferences call an old price.
 * @returns The securities to tick, which is the whole selection rather than an addition to it.
 */
export const selectSecurities = (
	plans: readonly PriceListingPlan[],
	kind: PriceSelectionKind,
	stalenessDays: number
): Set<LedgerId> => {
	const wanted = plans.filter((plan) => {
		if(kind === 'all') {
			return true;
		}

		if(kind === 'none') {
			return false;
		}

		if(kind === 'held') {
			return plan.isHeld;
		}

		if(kind === 'never-priced') {
			return plan.lastPrice === undefined;
		}

		return plan.lastPrice !== undefined && isPriceStale(plan.lastPrice.date, stalenessDays);
	});

	return new Set(wanted.map((plan) => {
		return plan.security.id;
	}));
};

/**
 * Reads one security's days against the file.
 *
 * **A day already holding exactly what came back is not written at all**, whatever wrote it: a hand-typed value the provider
 * agrees with stays `manual`, that field existing to say where a figure came from. It is counted as unchanged and nothing more,
 * which is what makes the same pass run twice write nothing the second time.
 * @param security The security.
 * @param days Every day that came back for it, oldest first.
 * @param droppedCount Days that came back and will not be written.
 * @param byDay Every price in the file, by security and day.
 * @returns The row.
 */
const toRow = (
	security: Security,
	days: QuotedDay[],
	droppedCount: number,
	byDay: ReadonlyMap<string, Price>
): PriceUpdateRow => {
	const newest = days[days.length - 1];
	const replacements: PriceReplacement[] = [];
	const writes: QuotedDay[] = [];
	let newCount = 0;
	let unchangedCount = 0;

	for(const day of days) {
		const previous = priceOnDayIndexed(byDay, security.id, day.date);

		if(previous === undefined) {
			newCount += 1;
			writes.push(day);
		}
		else if(previous.value === day.value) {
			unchangedCount += 1;
		}
		else {
			replacements.push({ date: day.date, value: day.value, previous });
			writes.push(day);
		}
	}

	return {
		security,
		value: newest.value,
		date: newest.date,
		days,
		writes,
		newCount,
		replacements,
		replacesManualCount: replacements.filter((replacement) => {
			return replacement.previous.source === 'manual';
		}).length,
		unchangedCount,
		droppedCount
	};
};

const toEntryState = (
	security: Security,
	outcome: PriceFetchOutcome,
	byDay: ReadonlyMap<string, Price>
): PriceUpdateEntry => {
	if(outcome.outcome === 'quoted') {
		return { security, state: 'quoted', row: toRow(security, outcome.days, outcome.droppedCount, byDay) };
	}

	// Only a request that did not complete could come back with something else. A refusal is the same refusal every time, and a
	// listing the provider does not carry does not start carrying it because it was asked twice.
	if(outcome.outcome === 'failed') {
		return {
			security,
			state: 'problem',
			problem: { security, reason: 'failed', message: outcome.message },
			retryable: true
		};
	}

	const problem: PriceUpdateProblem = outcome.outcome === 'refused' ?
		{ security, reason: 'refused', refusal: outcome.refusal, currency: outcome.currency } :
		{ security, reason: 'no-quote' };

	return { security, state: 'problem', problem, retryable: false };
};

/**
 * Reads what has come back against the file, which is what the review is made of.
 *
 * **It is called while the pass runs as well as when it ends**, so that the table fills in row by row rather than appearing
 * whole at the end: a listing not yet answered is queued, the one being asked for says so, and a security that was never ticked
 * says that.
 *
 * An outcome naming a security the file no longer holds is dropped: a pass takes time, and a security deleted while it was
 * running has no row to describe and nothing to write against.
 * @param options What the review is read from.
 * @param options.securities Every security in the file.
 * @param options.asked The listings the pass was given, in the order they are asked in.
 * @param options.outcomes What has come back so far, in the order it was asked for.
 * @param options.prices Every price in the file, which is what says whether a day is new.
 * @param options.referenceDate The moment the provider's figures are as of, where it states one.
 * @returns The review, one entry per security in the file, ordered by ticker.
 */
export const reviewPricePass = ({
	securities,
	asked,
	outcomes,
	prices,
	referenceDate
}: {
	securities: readonly Security[];
	asked: readonly LedgerId[];
	outcomes: readonly PriceFetchOutcome[];
	prices: readonly Price[];
	referenceDate?: IsoDate | undefined;
}): PriceUpdateReview => {
	// Built once and asked of every day, rather than the file being walked once per day of every series
	const byDay = indexPricesByDay(prices);
	const answered = new Map(outcomes.map((outcome) => {
		return [ outcome.securityId, outcome ];
	}));

	// The listing being asked for now, which is the first one still unanswered
	const asking = asked.find((securityId) => {
		return !answered.has(securityId);
	});

	const entries = sortSecurities(securities).map((security): PriceUpdateEntry => {
		const outcome = answered.get(security.id);

		if(outcome) {
			return toEntryState(security, outcome, byDay);
		}

		if(!asked.includes(security.id)) {
			return { security, state: 'not-asked' };
		}

		return security.id === asking ? { security, state: 'asking' } : { security, state: 'queued' };
	});

	return {
		referenceDate,
		entries,
		retryableIds: entries.filter((entry) => {
			return entry.state === 'problem' && entry.retryable;
		}).map((entry) => {
			return entry.security.id;
		})
	};
};

/**
 * The rows of a review, which is what the page ticks and what confirming writes.
 * @param review The review.
 * @returns The rows, in the order the entries are in.
 */
export const rowsOfReview = (review: PriceUpdateReview): PriceUpdateRow[] => {
	return review.entries.flatMap((entry) => {
		return entry.state === 'quoted' ? [ entry.row ] : [];
	});
};

/**
 * The problems of a review, which are the securities nothing will be written for.
 * @param review The review.
 * @returns The problems, in the order the entries are in.
 */
export const problemsOfReview = (review: PriceUpdateReview): PriceUpdateProblem[] => {
	return review.entries.flatMap((entry) => {
		return entry.state === 'problem' ? [ entry.problem ] : [];
	});
};

/**
 * Totals what confirming a set of rows would do, which is the one line under the table.
 * @param rows The rows that are ticked.
 * @returns The totals.
 */
export const summarisePriceWrites = (rows: readonly PriceUpdateRow[]): PriceWriteSummary => {
	const total = (read: (row: PriceUpdateRow) => number): number => {
		return rows.reduce((sum, row) => {
			return sum + read(row);
		}, 0);
	};

	return {
		writeCount: total((row) => {
			return row.writes.length;
		}),
		securityCount: rows.filter((row) => {
			return row.writes.length > 0;
		}).length,
		replacedCount: total((row) => {
			return row.replacements.length;
		}),
		replacedManualCount: total((row) => {
			return row.replacesManualCount;
		}),
		unchangedCount: total((row) => {
			return row.unchangedCount;
		}),
		droppedCount: total((row) => {
			return row.droppedCount;
		})
	};
};

/**
 * Turns the rows the page ticked into the records confirming writes.
 *
 * **Every one of them is `fetched`**, a hand-typed value of a different figure it replaces included: a day holds one price, the
 * last word on it wins, and what the history then shows against that day is what the record says it is. **An unchanged day is
 * not among them**, so nothing is rewritten to say it came from somewhere it did not.
 * @param rows The rows that are ticked.
 * @returns The Price records to write.
 */
export const toFetchedPrices = (rows: readonly PriceUpdateRow[]): Price[] => {
	return rows.flatMap((row) => {
		return row.writes.map((day) => {
			return {
				securityId: row.security.id,
				date: day.date,
				value: day.value,
				source: 'fetched' as const
			};
		});
	});
};
