import { createFormatter } from 'src/logic/format/Formatter';
import {
	formatAmount,
	formatInteger,
	formatMagnitude,
	formatPercentage,
	formatQuantity,
	formatUnitPrice,
	fractionToPercentageTenths,
	percentageTenthsToFraction,
	type SeparatorCharacters
} from 'src/logic/format/NumberFormat';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';

const ITALIAN: SeparatorCharacters = { decimal: ',', thousands: '.' };

const ENGLISH: SeparatorCharacters = { decimal: '.', thousands: ',' };

const NO_THOUSANDS: SeparatorCharacters = { decimal: ',', thousands: '' };

describe('formatMagnitude', () => {
	test('groups the whole part by threes', () => {
		expect(formatMagnitude(182040001, 2, ITALIAN)).toBe('1.820.400,01');
	});

	test('leaves a figure below a thousand ungrouped', () => {
		expect(formatMagnitude(34057, 2, ITALIAN)).toBe('340,57');
	});

	test('prints nothing between the groups when the preference is none', () => {
		expect(formatMagnitude(2190000, 2, NO_THOUSANDS)).toBe('21900,00');
	});

	test('drops the sign, which is the caller’s business', () => {
		expect(formatMagnitude(-10000, 2, ITALIAN)).toBe('100,00');
	});
});

describe('formatAmount', () => {
	test('prints the currency before every amount, with exactly two decimals', () => {
		expect(formatAmount(2190000, ITALIAN)).toBe('€ 21.900,00');
		expect(formatAmount(0, ITALIAN)).toBe('€ 0,00');
	});

	test('puts the sign in front of the currency on a negative figure', () => {
		expect(formatAmount(-10000, ITALIAN)).toBe('− € 100,00');
	});

	test('states the direction of a positive figure only when it is asked to', () => {
		expect(formatAmount(125000, ITALIAN)).toBe('€ 1.250,00');
		expect(formatAmount(125000, ITALIAN, true)).toBe('+ € 1.250,00');
	});

	test('never signs a zero, even when directions are being stated', () => {
		expect(formatAmount(0, ITALIAN, true)).toBe('€ 0,00');
	});

	test('follows the separators rather than a system locale', () => {
		expect(formatAmount(182040001, ENGLISH)).toBe('€ 1,820,400.01');
	});
});

describe('the four-decimal figures', () => {
	test('print a unit price with the currency and four decimals', () => {
		expect(formatUnitPrice(1082150, ITALIAN)).toBe('€ 108,2150');
	});

	test('print a quantity with six decimals and no currency', () => {
		expect(formatQuantity(12500000, ITALIAN)).toBe('12,500000');
		expect(formatQuantity(311623, ITALIAN)).toBe('0,311623');
	});
});

describe('formatPercentage', () => {
	test('shows a stored fraction as the percentage it names, to one decimal', () => {
		expect(formatPercentage(2600, ITALIAN)).toBe('26,0%');
		expect(formatPercentage(1250, ITALIAN)).toBe('12,5%');
	});

	test('rounds a computed fraction half away from zero', () => {
		expect(formatPercentage(1255, ITALIAN)).toBe('12,6%');
		expect(formatPercentage(-1255, ITALIAN)).toBe('− 12,6%');
	});

	test('round-trips what a form holds', () => {
		expect(fractionToPercentageTenths(2600)).toBe(260);
		expect(percentageTenthsToFraction(260)).toBe(2600);
	});
});

describe('formatInteger', () => {
	test('groups a whole number and gives it no decimals', () => {
		expect(formatInteger(1000, ITALIAN)).toBe('1.000');
		expect(formatInteger(30, ITALIAN)).toBe('30');
	});
});

describe('the formatter', () => {
	test('binds every figure to the preferences in force', () => {
		const formatter = createFormatter(DEFAULT_PREFERENCES);

		expect(formatter.amount(2190000)).toBe('€ 21.900,00');
		expect(formatter.percentage(DEFAULT_PREFERENCES.defaultTaxRate)).toBe('26,0%');
		expect(formatter.date(new Date(2026, 7, 8))).toBe('08/08/2026');
	});

	test('prints the same figure differently once a preference changes', () => {
		const formatter = createFormatter({ ...DEFAULT_PREFERENCES, decimalSeparator: 'dot', thousandsSeparator: 'space', dateFormat: 'YYYY-MM-DD' });

		expect(formatter.amount(2190000)).toBe('€ 21 900.00');
		expect(formatter.date(new Date(2026, 7, 8))).toBe('2026-08-08');
	});
});
