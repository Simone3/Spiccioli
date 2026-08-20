import { ACCEPTED_CURRENCY, reviewProviderQuotes, type ProviderResponseToReview } from 'src/main/prices/PriceQuoteReview';
import type { PriceSpan, ProviderDay } from 'src/main/prices/PriceProvider';

/**
 * The four refusals of the specification, none of which needs a provider to test.
 *
 * **Where each one falls is the half worth testing.** The currency is stated once and takes the whole response with it; the date
 * and the figure are a day's own, and inside a span they take that day and leave the rest.
 */

const TODAY = '2026-08-08';

const LATEST: PriceSpan = { kind: 'latest' };

const SINCE: PriceSpan = { kind: 'window', from: '2026-08-01', to: '2026-08-08' };

const quote = (overrides: Partial<ProviderDay> = {}): ProviderResponseToReview => {
	return { days: [ { price: 92.31, date: '2026-08-07', ...overrides } ], blankDays: 0, currency: ACCEPTED_CURRENCY };
};

const series = (days: ProviderDay[], blankDays = 0): ProviderResponseToReview => {
	return { days, blankDays, currency: ACCEPTED_CURRENCY };
};

const currency = (value: string | null): ProviderResponseToReview => {
	return { ...quote(), currency: value };
};

describe('reviewing a provider quote', () => {
	test('takes a EUR quote dated today or earlier, at the scale a price is stored in', () => {
		expect(reviewProviderQuotes(quote(), TODAY, LATEST)).toEqual({ outcome: 'quoted', days: [ { value: 923100, date: '2026-08-07' } ], droppedCount: 0 });
		expect(reviewProviderQuotes(quote({ date: TODAY }), TODAY, LATEST)).toEqual({ outcome: 'quoted', days: [ { value: 923100, date: TODAY } ], droppedCount: 0 });
	});

	test('narrows to the fourth decimal once, rounding half away from zero', () => {
		expect(reviewProviderQuotes(quote({ price: 4.86105 }), TODAY, LATEST)).toEqual({ outcome: 'quoted', days: [ { value: 48611, date: '2026-08-07' } ], droppedCount: 0 });
		expect(reviewProviderQuotes(quote({ price: 0.00005 }), TODAY, LATEST)).toEqual({ outcome: 'quoted', days: [ { value: 1, date: '2026-08-07' } ], droppedCount: 0 });
	});

	test('refuses a quote dated in the future', () => {
		expect(reviewProviderQuotes(quote({ date: '2026-08-09' }), TODAY, LATEST)).toEqual({
			outcome: 'refused',
			refusal: 'future-date',
			currency: null
		});
	});

	test('refuses a quote of zero or less, a figure that rounds away to nothing included', () => {
		expect(reviewProviderQuotes(quote({ price: 0 }), TODAY, LATEST)).toEqual({ outcome: 'refused', refusal: 'not-positive', currency: null });
		expect(reviewProviderQuotes(quote({ price: -3.5 }), TODAY, LATEST)).toEqual({ outcome: 'refused', refusal: 'not-positive', currency: null });
		expect(reviewProviderQuotes(quote({ price: 0.00001 }), TODAY, LATEST)).toEqual({ outcome: 'refused', refusal: 'not-positive', currency: null });
	});

	test('refuses a quote stated in anything but EUR, and names what it was stated in', () => {
		expect(reviewProviderQuotes(currency('USD'), TODAY, LATEST)).toEqual({
			outcome: 'refused',
			refusal: 'not-euro',
			currency: 'USD'
		});
		expect(reviewProviderQuotes(currency('gbp'), TODAY, LATEST)).toEqual({
			outcome: 'refused',
			refusal: 'not-euro',
			currency: 'GBP'
		});
	});

	test('refuses a quote with no currency stated at all — an unlabelled number is not evidence of anything', () => {
		expect(reviewProviderQuotes(currency(null), TODAY, LATEST)).toEqual({
			outcome: 'refused',
			refusal: 'no-currency',
			currency: null
		});
		expect(reviewProviderQuotes(currency('  '), TODAY, LATEST)).toEqual({
			outcome: 'refused',
			refusal: 'no-currency',
			currency: null
		});
	});

	test('names the currency before anything else, a zero quote in dollars being a currency problem', () => {
		expect(reviewProviderQuotes({ ...quote({ price: 0 }), currency: 'USD' }, TODAY, LATEST)).toEqual({
			outcome: 'refused',
			refusal: 'not-euro',
			currency: 'USD'
		});
	});

	test('cuts a currency the provider padded out, so nothing it sends can grow a row without limit', () => {
		const reviewed = reviewProviderQuotes(currency('X'.repeat(200)), TODAY, LATEST);

		expect(reviewed.outcome).toBe('refused');
		expect(reviewed.outcome === 'refused' && reviewed.currency?.length).toBe(12);
	});

	test('refuses a whole series stated in anything but EUR, the currency being stated once for all of it', () => {
		expect(reviewProviderQuotes({
			days: [ { price: 10, date: '2026-08-05' }, { price: 11, date: '2026-08-06' } ],
			blankDays: 0,
			currency: 'USD'
		}, TODAY, SINCE)).toEqual({ outcome: 'refused', refusal: 'not-euro', currency: 'USD' });
	});

	test('drops a bad day of a series and keeps the rest, counting the blank ones with it', () => {
		const reviewed = reviewProviderQuotes(series([
			{ price: 10, date: '2026-08-05' },
			{ price: 0, date: '2026-08-06' },
			{ price: 11, date: '2026-08-07' },
			{ price: 12, date: '2026-08-09' }
		], 2), TODAY, SINCE);

		expect(reviewed).toEqual({
			outcome: 'quoted',
			days: [ { value: 100000, date: '2026-08-05' }, { value: 110000, date: '2026-08-07' } ],
			droppedCount: 4
		});
	});

	test('reports a series that lost every day as a listing with no quote, rather than naming one day of it', () => {
		expect(reviewProviderQuotes(series([ { price: 0, date: '2026-08-05' } ]), TODAY, SINCE)).toEqual({ outcome: 'no-quote' });
	});

	test('still names the refusal where the pass asked for one quote and that quote fell to it', () => {
		expect(reviewProviderQuotes(quote({ price: 0 }), TODAY, LATEST)).toEqual({
			outcome: 'refused',
			refusal: 'not-positive',
			currency: null
		});
	});
});
