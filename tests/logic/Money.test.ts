import {
	divideAtWorkingScale,
	formatMinorUnitsAsPlainDecimal,
	MONEY_SCALES,
	multiplyAtRateScale,
	narrowFromWorkingScale,
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

	test('takes a quantity times a unit price there without losing anything', () => {
		// 12,5 units at 34,5678 each
		expect(multiplyAtRateScale(125000, 345678)).toBe(43209750000);
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

describe('divideAtWorkingScale', () => {
	test('divides a cost basis by a quantity', () => {
		// 1.000,00 spent on 40 units is 25,00 each
		const costBasis = widenToWorkingScale(100000, MONEY_SCALES.amount);
		const quantity = widenToWorkingScale(400000, MONEY_SCALES.rate);

		expect(narrowFromWorkingScale(divideAtWorkingScale(costBasis, quantity), MONEY_SCALES.amount)).toBe(2500);
	});

	test('keeps a repeating quotient at the working scale', () => {
		const numerator = widenToWorkingScale(100, MONEY_SCALES.amount);
		const denominator = widenToWorkingScale(30000, MONEY_SCALES.rate);

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
