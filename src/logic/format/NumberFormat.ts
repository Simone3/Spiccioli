import { MONEY_SCALES, roundHalfAwayFromZero } from 'src/logic/money/Money';

/**
 * Printing a stored figure the way the preferences say a figure is printed.
 *
 * Every figure in the file is an integer in minor units, so printing one is splitting it at its scale and putting the two
 * separators in — never a floating-point conversion, and never a locale's own formatter: the separators are a preference and not
 * a system setting, exactly as the date format is.
 *
 * **Every monetary figure carries exactly two decimals**, quantities and unit prices four, percentages one — so a round thousand
 * reads "€ 21.900,00" and a column of figures always aligns on the same decimal place. **Every amount is EUR and is printed with
 * "€" before it**; there is no currency field and nothing to choose.
 *
 * **The only figures written short are a chart's axis labels** ([§11]), which is the one thing `formatCompactAmount` is for.
 * Every other figure in the application is printed in full, this exception included: the axis writes the tick, the tooltip
 * beside it writes the amount.
 */

// The one currency, fixed rather than chosen, with the space the mockups put after it
const CURRENCY_PREFIX = '€ ';

// A true minus rather than a hyphen, and a plus where a figure states its direction. Both are followed by a space.
const NEGATIVE_SIGN = '− ';

const POSITIVE_SIGN = '+ ';

const GROUP_SIZE = 3;

// The three scales a compact amount is written at, in cents: one euro, one thousand euros, one million euros
const CENTS_PER_UNIT = 100;

const CENTS_PER_THOUSAND = 100_000;

const CENTS_PER_MILLION = 100_000_000;

// How many decimals a compact amount keeps where the scale it is written at would otherwise lose the figure
const COMPACT_SCALE = 1;

const COMPACT_TENTHS = 10;

// How many decimals a percentage carries, which is also the scale the fraction is narrowed to before it is printed
export const PERCENTAGE_SCALE = 1;

// A fraction is stored in ten-thousandths and shown as a percentage, so the × 100 and the narrowing to one decimal are one step
const FRACTION_TO_PERCENTAGE_TENTHS = 10;

// What a compact amount writes a thousand and a million with. They are words and so are the caller's, this file holding none.
export interface CompactUnitLabels {
	thousands: string;
	millions: string;
}

export interface SeparatorCharacters {
	decimal: string;

	// Empty when the preference is "none", which prints "21900,00"
	thousands: string;
}

const groupWholeDigits = (digits: string, thousandsSeparator: string): string => {
	if(!thousandsSeparator || digits.length <= GROUP_SIZE) {
		return digits;
	}

	const groups: string[] = [];

	for(let end = digits.length; end > 0; end -= GROUP_SIZE) {
		groups.unshift(digits.slice(Math.max(0, end - GROUP_SIZE), end));
	}

	return groups.join(thousandsSeparator);
};

/**
 * Prints a figure in minor units as digits, grouped and separated the way the preferences say.
 * The sign is not printed here: what goes in front of a figure differs by what it is, and every caller below decides it.
 * @param value Figure in minor units. Its sign is dropped.
 * @param scale Decimal places that figure carries.
 * @param separators The two characters the preferences hold.
 * @returns The magnitude as text, with every decimal place its scale carries.
 */
export const formatMagnitude = (value: number, scale: number, separators: SeparatorCharacters): string => {
	const factor = 10 ** scale;
	const magnitude = Math.abs(value);
	const wholePart = Math.trunc(magnitude / factor);
	const decimalPart = magnitude - wholePart * factor;
	const grouped = groupWholeDigits(String(wholePart), separators.thousands);

	if(scale === 0) {
		return grouped;
	}

	return `${grouped}${separators.decimal}${String(decimalPart).padStart(scale, '0')}`;
};

const signOf = (value: number, explicitSign: boolean): string => {
	if(value < 0) {
		return NEGATIVE_SIGN;
	}

	// A zero is never signed, whichever way it was asked for: it has no direction to state
	return explicitSign && value > 0 ? POSITIVE_SIGN : '';
};

/**
 * Prints an amount at one coarser scale, keeping the one decimal that scale would otherwise lose.
 * @param cents The amount, in cents.
 * @param centsPerUnit How many cents the scale's unit is worth.
 * @param suffix What that unit is written with, empty for the euro itself.
 * @param separators The two characters the preferences hold.
 * @returns The amount at that scale, with its unit after it.
 */
const compactAtScale = (cents: number, centsPerUnit: number, suffix: string, separators: SeparatorCharacters): string => {
	const tenths = roundHalfAwayFromZero(Math.abs(cents) * COMPACT_TENTHS / centsPerUnit);

	const magnitude = tenths % COMPACT_TENTHS === 0 ?
		formatMagnitude(tenths / COMPACT_TENTHS, 0, separators) :
		formatMagnitude(tenths, COMPACT_SCALE, separators);

	return `${signOf(cents, false)}${CURRENCY_PREFIX}${magnitude}${suffix}`;
};

/**
 * Prints an amount in cents, with the currency symbol every monetary figure carries.
 * @param cents The amount, in cents.
 * @param separators The two characters the preferences hold.
 * @param explicitSign Whether a positive figure states its direction, which is what a transaction's amount does.
 * @returns The amount as text.
 */
export const formatAmount = (cents: number, separators: SeparatorCharacters, explicitSign = false): string => {
	return `${signOf(cents, explicitSign)}${CURRENCY_PREFIX}${formatMagnitude(cents, MONEY_SCALES.amount, separators)}`;
};

/**
 * Prints an amount at the coarsest scale that leaves it short: whole euros below a thousand, thousands below a million, and
 * millions above it. **It is what a chart's value axis writes** — a tick is one short line and never a wrapped one, and the
 * axis then takes a fraction of the width the full figures would need. Everything else prints the amount in full.
 *
 * **One decimal is kept where the coarser scale would otherwise lose the figure**, so a tick at € 2.500,00 reads "€ 2,5k"
 * rather than "€ 2k" or "€ 3k", and a round one drops the decimal it does not need. The division is the one inexact step and
 * rounds half away from zero, like every other in the application.
 * @param cents The amount, in cents.
 * @param separators The two characters the preferences hold.
 * @param units What a thousand and a million are written with, which is the caller's because this file holds no wording.
 * @returns The amount as text, at the scale it is short at.
 */
export const formatCompactAmount = (cents: number, separators: SeparatorCharacters, units: CompactUnitLabels): string => {
	const magnitude = Math.abs(cents);

	if(magnitude >= CENTS_PER_MILLION) {
		return compactAtScale(cents, CENTS_PER_MILLION, units.millions, separators);
	}

	if(magnitude >= CENTS_PER_THOUSAND) {
		return compactAtScale(cents, CENTS_PER_THOUSAND, units.thousands, separators);
	}

	return compactAtScale(cents, CENTS_PER_UNIT, '', separators);
};

/**
 * Prints a unit price, which is money at four decimals rather than two.
 * @param tenThousandths The price, in ten-thousandths.
 * @param separators The two characters the preferences hold.
 * @returns The price as text.
 */
export const formatUnitPrice = (tenThousandths: number, separators: SeparatorCharacters): string => {
	return `${signOf(tenThousandths, false)}${CURRENCY_PREFIX}${formatMagnitude(tenThousandths, MONEY_SCALES.rate, separators)}`;
};

/**
 * Prints a quantity, which carries six decimals and no currency.
 * @param millionths The quantity, in millionths.
 * @param separators The two characters the preferences hold.
 * @returns The quantity as text.
 */
export const formatQuantity = (millionths: number, separators: SeparatorCharacters): string => {
	return `${signOf(millionths, false)}${formatMagnitude(millionths, MONEY_SCALES.quantity, separators)}`;
};

/**
 * Prints a stored fraction as the percentage it names: 2600 ten-thousandths is 0,26 and reads "26,0%".
 * The × 100 happens here and nowhere else, which is what keeps every formula multiplying by the fraction itself.
 * @param fraction The rate, as a fraction in ten-thousandths.
 * @param separators The two characters the preferences hold.
 * @returns The percentage as text, with the one decimal a percentage carries.
 */
export const formatPercentage = (fraction: number, separators: SeparatorCharacters): string => {
	const percentageTenths = roundHalfAwayFromZero(fraction / FRACTION_TO_PERCENTAGE_TENTHS);

	return `${signOf(percentageTenths, false)}${formatMagnitude(percentageTenths, PERCENTAGE_SCALE, separators)}%`;
};

/**
 * Prints a whole number — a count, a number of days, a number of months — grouped like any other figure.
 * @param value The number.
 * @param separators The two characters the preferences hold.
 * @returns The number as text.
 */
export const formatInteger = (value: number, separators: SeparatorCharacters): string => {
	return `${signOf(value, false)}${formatMagnitude(value, 0, separators)}`;
};

/**
 * Turns a stored fraction into the percentage a form shows, in tenths of a percent: 2600 becomes 260.
 * @param fraction The rate, as a fraction in ten-thousandths.
 * @returns The same rate as a percentage, in tenths.
 */
export const fractionToPercentageTenths = (fraction: number): number => {
	return roundHalfAwayFromZero(fraction / FRACTION_TO_PERCENTAGE_TENTHS);
};

/**
 * Turns the percentage a form holds back into the fraction that is stored: 260 tenths of a percent becomes 2600.
 * @param percentageTenths The rate as a percentage, in tenths.
 * @returns The same rate as a fraction in ten-thousandths.
 */
export const percentageTenthsToFraction = (percentageTenths: number): number => {
	return percentageTenths * FRACTION_TO_PERCENTAGE_TENTHS;
};
