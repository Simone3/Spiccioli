import { ACCEPTED_CURRENCY, reviewProviderQuote } from 'src/main/prices/PriceQuoteReview';
import type { ProviderQuote } from 'src/main/prices/PriceProvider';

/**
 * The four refusals of the specification, none of which needs a provider to test.
 * Each one puts its security among the ones that could not be fetched, with its reason named, and leaves the price it already had.
 */

const TODAY = '2026-08-08';

const quote = (overrides: Partial<ProviderQuote> = {}): ProviderQuote => {
	return { price: 92.31, date: '2026-08-07', currency: ACCEPTED_CURRENCY, ...overrides };
};

describe('reviewing a provider quote', () => {
	test('takes a EUR quote dated today or earlier, at the scale a price is stored in', () => {
		expect(reviewProviderQuote(quote(), TODAY)).toEqual({ outcome: 'quoted', value: 923100, date: '2026-08-07' });
		expect(reviewProviderQuote(quote({ date: TODAY }), TODAY)).toEqual({ outcome: 'quoted', value: 923100, date: TODAY });
	});

	test('narrows to the fourth decimal once, rounding half away from zero', () => {
		expect(reviewProviderQuote(quote({ price: 4.86105 }), TODAY)).toEqual({ outcome: 'quoted', value: 48611, date: '2026-08-07' });
		expect(reviewProviderQuote(quote({ price: 0.00005 }), TODAY)).toEqual({ outcome: 'quoted', value: 1, date: '2026-08-07' });
	});

	test('refuses a quote dated in the future', () => {
		expect(reviewProviderQuote(quote({ date: '2026-08-09' }), TODAY)).toEqual({
			outcome: 'refused',
			refusal: 'future-date',
			currency: null
		});
	});

	test('refuses a quote of zero or less, a figure that rounds away to nothing included', () => {
		expect(reviewProviderQuote(quote({ price: 0 }), TODAY)).toEqual({ outcome: 'refused', refusal: 'not-positive', currency: null });
		expect(reviewProviderQuote(quote({ price: -3.5 }), TODAY)).toEqual({ outcome: 'refused', refusal: 'not-positive', currency: null });
		expect(reviewProviderQuote(quote({ price: 0.00001 }), TODAY)).toEqual({ outcome: 'refused', refusal: 'not-positive', currency: null });
	});

	test('refuses a quote stated in anything but EUR, and names what it was stated in', () => {
		expect(reviewProviderQuote(quote({ currency: 'USD' }), TODAY)).toEqual({
			outcome: 'refused',
			refusal: 'not-euro',
			currency: 'USD'
		});
		expect(reviewProviderQuote(quote({ currency: 'gbp' }), TODAY)).toEqual({
			outcome: 'refused',
			refusal: 'not-euro',
			currency: 'GBP'
		});
	});

	test('refuses a quote with no currency stated at all — an unlabelled number is not evidence of anything', () => {
		expect(reviewProviderQuote(quote({ currency: null }), TODAY)).toEqual({
			outcome: 'refused',
			refusal: 'no-currency',
			currency: null
		});
		expect(reviewProviderQuote(quote({ currency: '  ' }), TODAY)).toEqual({
			outcome: 'refused',
			refusal: 'no-currency',
			currency: null
		});
	});

	test('names the currency before anything else, a zero quote in dollars being a currency problem', () => {
		expect(reviewProviderQuote(quote({ price: 0, currency: 'USD' }), TODAY)).toEqual({
			outcome: 'refused',
			refusal: 'not-euro',
			currency: 'USD'
		});
	});

	test('cuts a currency the provider padded out, so nothing it sends can grow a row without limit', () => {
		const reviewed = reviewProviderQuote(quote({ currency: 'X'.repeat(200) }), TODAY);

		expect(reviewed.outcome).toBe('refused');
		expect(reviewed.outcome === 'refused' && reviewed.currency?.length).toBe(12);
	});
});
