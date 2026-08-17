/**
 * The arithmetic every figure in the file goes through.
 *
 * Every stored number is an integer in minor units — cents for money, ten-thousandths for quantities, unit prices and rates,
 * hundredths for "hoursPerDay" — so a sum, a difference and a product of stored figures are all exact, and a file round-trips
 * without moving. The working scale everything widens into is eight decimal places: a quantity times a unit price is four
 * decimals by four and lands there exactly, and an amount widens into it with room to spare.
 *
 * **A division is the only inexact step in the application**, and it rounds half away from zero, six orders of magnitude below
 * the cent anything is ever shown at. So do the deliberate roundings to the cent the calculations name. Neither ever uses the
 * language's own "Math.round", which rounds -0,5 to -0 and 0,5 to 1 and is therefore not symmetric.
 *
 * Nothing here needs a dependency: a number holds an integer exactly to 2^53, which is orders of magnitude past what a personal
 * ledger holds at either scale.
 */

// How many decimal places each kind of stored figure carries, and the scale everything is widened into before it is combined
export const MONEY_SCALES = {
	amount: 2,
	rate: 4,
	hundredths: 2,
	working: 8
} as const;

const SCALE_FACTORS: readonly number[] = [ 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000 ];

const WORKING_SCALE_FACTOR = SCALE_FACTORS[MONEY_SCALES.working];

export const DIVISION_BY_ZERO_MESSAGE = 'Cannot divide by zero.';

export const UNSUPPORTED_SCALE_MESSAGE = 'Unsupported decimal scale.';

const getScaleFactor = (scale: number): number => {
	const factor = SCALE_FACTORS[scale];

	if(factor === undefined) {
		throw new Error(`${UNSUPPORTED_SCALE_MESSAGE} ${scale}`);
	}

	return factor;
};

/**
 * Rounds to the nearest integer, with a half going away from zero in both directions.
 * @param value Figure to round.
 * @returns The rounded figure, never a negative zero.
 */
export const roundHalfAwayFromZero = (value: number): number => {
	const rounded = value < 0 ? -Math.round(-value) : Math.round(value);

	return rounded === 0 ? 0 : rounded;
};

/**
 * Widens a stored figure into the working scale, which is exact for every scale the file uses.
 * @param value Figure in its own minor units.
 * @param scale Decimal places that figure carries.
 * @returns The same figure at the working scale.
 */
export const widenToWorkingScale = (value: number, scale: number): number => {
	return value * getScaleFactor(MONEY_SCALES.working - scale);
};

/**
 * Narrows a working-scale figure back to a stored scale. This is a division, so it rounds half away from zero.
 * @param value Figure at the working scale.
 * @param scale Decimal places to land on.
 * @returns The figure in that scale's minor units.
 */
export const narrowFromWorkingScale = (value: number, scale: number): number => {
	return roundHalfAwayFromZero(value / getScaleFactor(MONEY_SCALES.working - scale));
};

/**
 * Multiplies two four-decimal figures, which lands on the working scale exactly. A quantity times a unit price is this operation.
 * @param first Four-decimal figure, in ten-thousandths.
 * @param second Four-decimal figure, in ten-thousandths.
 * @returns Their product, at the working scale.
 */
export const multiplyAtRateScale = (first: number, second: number): number => {
	return first * second;
};

/**
 * Divides one working-scale figure by another, at the working scale.
 *
 * The whole part and the remainder are taken separately rather than scaling the numerator up first: a working-scale figure is
 * already large, and multiplying it by another hundred million before dividing would leave the range a number represents exactly.
 * @param numerator Figure at the working scale.
 * @param denominator Figure at the working scale. Zero is a caller's mistake and throws.
 * @returns The quotient at the working scale, rounded half away from zero.
 */
export const divideAtWorkingScale = (numerator: number, denominator: number): number => {
	if(denominator === 0) {
		throw new Error(DIVISION_BY_ZERO_MESSAGE);
	}

	const wholePart = Math.trunc(numerator / denominator);
	const remainder = numerator - wholePart * denominator;

	return roundHalfAwayFromZero(wholePart * WORKING_SCALE_FACTOR + remainder / denominator * WORKING_SCALE_FACTOR);
};

/**
 * Multiplies a working-scale figure by a four-decimal one and lands back on the working scale.
 *
 * It is what a quantity times a weighted average cost is, and what a taxable gain times a tax rate is: one side has already been
 * widened and the other is a stored `decimal(4)`, so the plain product would be four decimal places too far to the left. The
 * working operand is split into its whole part and its remainder before it is multiplied, exactly as the division below is, so
 * the largest intermediate figure is the size of the answer rather than ten thousand times it.
 * @param value Figure at the working scale.
 * @param rate Four-decimal figure, in ten-thousandths.
 * @returns Their product, at the working scale, rounded half away from zero.
 */
export const multiplyWorkingScaleByRateScale = (value: number, rate: number): number => {
	const factor = getScaleFactor(MONEY_SCALES.rate);
	const wholePart = Math.trunc(value / factor);
	const remainder = value - wholePart * factor;

	return roundHalfAwayFromZero(wholePart * rate + remainder * rate / factor);
};

/**
 * Rounds a working-scale figure to the cent and leaves it at the working scale.
 *
 * The calculations name exactly two figures that are rounded before they are subtracted rather than at display — the hypothetical
 * capital-gains tax on a holding and the exit tax on a pension fund — and this is that rounding. Everything downstream of it goes
 * on being combined at the working scale.
 * @param value Figure at the working scale.
 * @returns The same figure with nothing below the cent, still at the working scale.
 */
export const roundWorkingScaleToCents = (value: number): number => {
	return widenToWorkingScale(narrowFromWorkingScale(value, MONEY_SCALES.amount), MONEY_SCALES.amount);
};

/**
 * Reads what a person typed into a figure in minor units. One of the four boundaries where a decimal becomes an integer.
 *
 * It admits exactly one shape: an optional sign, digits, and at most as many decimals as the scale allows after a single
 * separator. Anything else — a thousands separator, a second separator, a letter, an empty field, more decimals than the scale
 * carries — is refused rather than rounded, so no figure enters the file having been silently reinterpreted.
 * @param text What was typed.
 * @param scale Decimal places the field carries.
 * @param decimalSeparator The one decimal character this field accepts.
 * @returns The figure in minor units, or undefined when the text is not one this field admits.
 */
export const parseDecimalToMinorUnits = (text: string, scale: number, decimalSeparator: string): number | undefined => {
	getScaleFactor(scale);

	const parts = text.trim().split(decimalSeparator);

	// A second separator is a thousands separator or a typo, and this field reads neither
	if(parts.length > 2) {
		return undefined;
	}

	const signedWholeDigits = parts[0];
	const decimalDigits = parts[1] ?? '';
	const isNegative = signedWholeDigits.startsWith('-');
	const wholeDigits = isNegative || signedWholeDigits.startsWith('+') ? signedWholeDigits.slice(1) : signedWholeDigits;

	if(!/^\d*$/.test(wholeDigits) || !/^\d*$/.test(decimalDigits)) {
		return undefined;
	}

	// A separator with nothing on either side of it is not a figure, and neither is a bare sign
	if(!wholeDigits && !decimalDigits) {
		return undefined;
	}

	if(decimalDigits.length > scale) {
		return undefined;
	}

	const minorUnits = Number(`${wholeDigits || '0'}${decimalDigits.padEnd(scale, '0')}`);

	if(!Number.isSafeInteger(minorUnits)) {
		return undefined;
	}

	return isNegative ? -minorUnits : minorUnits;
};

/**
 * Writes a figure in minor units back out as digits and a separator, with every decimal place its scale carries.
 * It is the inverse of the parse above and knows nothing about thousands separators or currency symbols, which belong to display.
 * @param value Figure in minor units.
 * @param scale Decimal places that figure carries.
 * @param decimalSeparator Character to put before the decimals.
 * @returns The figure as plain text.
 */
export const formatMinorUnitsAsPlainDecimal = (value: number, scale: number, decimalSeparator: string): string => {
	const factor = getScaleFactor(scale);
	const sign = value < 0 ? '-' : '';
	const magnitude = Math.abs(value);
	const wholePart = Math.trunc(magnitude / factor);
	const decimalPart = magnitude - wholePart * factor;

	if(scale === 0) {
		return `${sign}${wholePart}`;
	}

	return `${sign}${wholePart}${decimalSeparator}${String(decimalPart).padStart(scale, '0')}`;
};
