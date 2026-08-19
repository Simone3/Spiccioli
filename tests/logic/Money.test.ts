import {
	divideAtWorkingScale,
	formatMinorUnitsAsPlainDecimal,
	MONEY_SCALES,
	multiplyQuantityByRateScale,
	narrowFromWorkingScale,
	narrowPartsFromWorkingScale,
	parseDecimalToMinorUnits,
	roundHalfAwayFromZero,
	widenToWorkingScale
} from 'src/logic/money/Money';

describe('roundHalfAwayFromZero', () => {
	test('sends a half away from zero in both directions', () => {
		expect(roundHalfAwayFromZero(0.5)).toBe(1);
		expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
		expect(roundHalfAwayFromZero(1.5)).toBe(2);
		expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
		expect(roundHalfAwayFromZero(2.5)).toBe(3);
		expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
	});

	test('is symmetric where the language is not', () => {
		expect(Math.round(-0.5)).toBe(-0);
		expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
	});

	test('never produces a negative zero', () => {
		expect(Object.is(roundHalfAwayFromZero(-0.4), 0)).toBe(true);
	});

	test('leaves everything that is not a half alone', () => {
		expect(roundHalfAwayFromZero(2.49)).toBe(2);
		expect(roundHalfAwayFromZero(-2.49)).toBe(-2);
		expect(roundHalfAwayFromZero(7)).toBe(7);
	});
});

describe('the working scale', () => {
	test('widens an amount into it exactly', () => {
		expect(widenToWorkingScale(12345, MONEY_SCALES.amount)).toBe(12345000000);
	});

	test('widens a rate-scale figure into it exactly', () => {
		expect(widenToWorkingScale(12345, MONEY_SCALES.rate)).toBe(123450000);
	});

	test('takes a quantity times a unit price there', () => {
		// 12,5 units at 34,5678 each, which needs nothing below the working scale
		expect(multiplyQuantityByRateScale(12500000, 345678)).toBe(43209750000);
	});

	test('rounds the two places a quantity times a unit price falls past the working scale', () => {
		// 0,311623 units at 104,3100 is 32,505395130 — the last digit is what the working scale cannot hold
		expect(multiplyQuantityByRateScale(311623, 1043100)).toBe(3250539513);
	});

	test('narrows back to the cent, rounding half away from zero', () => {
		expect(narrowFromWorkingScale(43209750000, MONEY_SCALES.amount)).toBe(43210);
		expect(narrowFromWorkingScale(-43209750000, MONEY_SCALES.amount)).toBe(-43210);
	});

	test('round-trips a stored amount that is never divided', () => {
		[ 0, 1, -1, 999999999, -250050 ].forEach((amount) => {
			expect(narrowFromWorkingScale(widenToWorkingScale(amount, MONEY_SCALES.amount), MONEY_SCALES.amount)).toBe(amount);
		});
	});
});

describe('narrowPartsFromWorkingScale', () => {
	const cent = 1000000;

	test('leaves parts that already add to their total alone', () => {
		const parts = [ 300000 * cent, 2000 * cent, -450 * cent ];

		expect(narrowPartsFromWorkingScale(parts, MONEY_SCALES.amount)).toEqual([ 300000, 2000, -450 ]);
	});

	test('gives the cent back to the part that gave up the most of it', () => {
		// The four lines of a net worth of 3.024,68: the cost line is 20,006667 and the gain line is 4,677333, and each of them
		// rounded on its own prints a column that reads a cent over the headline
		const parts = [ 300000 * cent, 2000.666666 * cent, 467.733334 * cent, 0 ];
		const narrowed = narrowPartsFromWorkingScale(parts, MONEY_SCALES.amount);

		expect(narrowed).toEqual([ 300000, 2000, 468, 0 ]);
		expect(narrowed.reduce((running, part) => {
			return running + part;
		}, 0)).toBe(302468);
	});

	test('takes the cent from the part that was rounded furthest the other way', () => {
		const parts = [ 100.3 * cent, 100.3 * cent, 100.2 * cent ];
		const narrowed = narrowPartsFromWorkingScale(parts, MONEY_SCALES.amount);

		expect(narrowed).toEqual([ 101, 100, 100 ]);
	});

	test('makes the parts add to the total on every sign', () => {
		const cases = [
			[ -100.5 * cent, -200.5 * cent, 0.5 * cent ],
			[ 0.5 * cent, -0.5 * cent, 0.5 * cent, -0.5 * cent ],
			[ 1.4 * cent, 1.4 * cent, 1.4 * cent, 1.4 * cent, 1.4 * cent ],
			[ -1.6 * cent, -1.6 * cent, -1.6 * cent ]
		];

		cases.forEach((parts) => {
			const total = narrowFromWorkingScale(parts.reduce((running, part) => {
				return running + part;
			}, 0), MONEY_SCALES.amount);

			expect(narrowPartsFromWorkingScale(parts, MONEY_SCALES.amount).reduce((running, part) => {
				return running + part;
			}, 0)).toBe(total);
		});
	});

	test('never moves a part by more than one minor unit', () => {
		const parts = [ 12.4 * cent, 12.4 * cent, 12.4 * cent, 12.4 * cent ];

		narrowPartsFromWorkingScale(parts, MONEY_SCALES.amount).forEach((part, index) => {
			expect(Math.abs(part - narrowFromWorkingScale(parts[index], MONEY_SCALES.amount))).toBeLessThanOrEqual(1);
		});
	});
});

describe('divideAtWorkingScale', () => {
	test('divides a cost basis by a quantity', () => {
		// 1.000,00 spent on 40 units is 25,00 each
		const costBasis = widenToWorkingScale(100000, MONEY_SCALES.amount);
		const quantity = widenToWorkingScale(40000000, MONEY_SCALES.quantity);

		expect(narrowFromWorkingScale(divideAtWorkingScale(costBasis, quantity), MONEY_SCALES.amount)).toBe(2500);
	});

	test('keeps a repeating quotient at the working scale', () => {
		const numerator = widenToWorkingScale(100, MONEY_SCALES.amount);
		const denominator = widenToWorkingScale(3000000, MONEY_SCALES.quantity);

		// 1,00 over 3 is 0,33333333 at eight decimal places
		expect(divideAtWorkingScale(numerator, denominator)).toBe(33333333);
	});

	test('rounds a negative quotient away from zero', () => {
		const numerator = widenToWorkingScale(-1, MONEY_SCALES.amount);
		const denominator = widenToWorkingScale(20000, MONEY_SCALES.rate);

		expect(divideAtWorkingScale(numerator, denominator)).toBe(-500000);
		expect(divideAtWorkingScale(-numerator, denominator)).toBe(500000);
	});

	test('refuses to divide by zero rather than producing an infinity', () => {
		expect(() => {
			return divideAtWorkingScale(1, 0);
		}).toThrow();
	});
});

describe('parseDecimalToMinorUnits', () => {
	test('reads what the amount field admits', () => {
		expect(parseDecimalToMinorUnits('12', MONEY_SCALES.amount, ',')).toBe(1200);
		expect(parseDecimalToMinorUnits('12,3', MONEY_SCALES.amount, ',')).toBe(1230);
		expect(parseDecimalToMinorUnits('12,34', MONEY_SCALES.amount, ',')).toBe(1234);
		expect(parseDecimalToMinorUnits('-12,34', MONEY_SCALES.amount, ',')).toBe(-1234);
		expect(parseDecimalToMinorUnits('0', MONEY_SCALES.amount, ',')).toBe(0);
		expect(parseDecimalToMinorUnits(',5', MONEY_SCALES.amount, ',')).toBe(50);
	});

	test('reads four decimals where the field carries four', () => {
		expect(parseDecimalToMinorUnits('1,2345', MONEY_SCALES.rate, ',')).toBe(12345);
		expect(parseDecimalToMinorUnits('1,2345', MONEY_SCALES.amount, ',')).toBeUndefined();
	});

	test('refuses more decimals than the scale carries rather than rounding them away', () => {
		expect(parseDecimalToMinorUnits('12,345', MONEY_SCALES.amount, ',')).toBeUndefined();
	});

	test('refuses a thousands separator, a second separator and anything that is not a figure', () => {
		expect(parseDecimalToMinorUnits('1.234,00', MONEY_SCALES.amount, ',')).toBeUndefined();
		expect(parseDecimalToMinorUnits('1,2,3', MONEY_SCALES.amount, ',')).toBeUndefined();
		expect(parseDecimalToMinorUnits('12.34', MONEY_SCALES.amount, ',')).toBeUndefined();
		expect(parseDecimalToMinorUnits('twelve', MONEY_SCALES.amount, ',')).toBeUndefined();
		expect(parseDecimalToMinorUnits('', MONEY_SCALES.amount, ',')).toBeUndefined();
		expect(parseDecimalToMinorUnits('-', MONEY_SCALES.amount, ',')).toBeUndefined();
		expect(parseDecimalToMinorUnits(',', MONEY_SCALES.amount, ',')).toBeUndefined();
	});

	test('follows the decimal separator it is given', () => {
		expect(parseDecimalToMinorUnits('12.34', MONEY_SCALES.amount, '.')).toBe(1234);
		expect(parseDecimalToMinorUnits('12,34', MONEY_SCALES.amount, '.')).toBeUndefined();
	});
});

describe('formatMinorUnitsAsPlainDecimal', () => {
	test('writes every decimal place the scale carries', () => {
		expect(formatMinorUnitsAsPlainDecimal(1234, MONEY_SCALES.amount, ',')).toBe('12,34');
		expect(formatMinorUnitsAsPlainDecimal(1200, MONEY_SCALES.amount, ',')).toBe('12,00');
		expect(formatMinorUnitsAsPlainDecimal(5, MONEY_SCALES.amount, ',')).toBe('0,05');
		expect(formatMinorUnitsAsPlainDecimal(12345, MONEY_SCALES.rate, ',')).toBe('1,2345');
	});

	test('keeps the sign in front of the whole figure', () => {
		expect(formatMinorUnitsAsPlainDecimal(-1234, MONEY_SCALES.amount, ',')).toBe('-12,34');
		expect(formatMinorUnitsAsPlainDecimal(-5, MONEY_SCALES.amount, ',')).toBe('-0,05');
	});

	test('is the inverse of the parse', () => {
		[ 0, 5, -5, 1234, -1234, 999999999 ].forEach((minorUnits) => {
			const text = formatMinorUnitsAsPlainDecimal(minorUnits, MONEY_SCALES.amount, ',');

			expect(parseDecimalToMinorUnits(text, MONEY_SCALES.amount, ',')).toBe(minorUnits);
		});
	});
});
