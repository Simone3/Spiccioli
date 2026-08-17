import {
	DATE_FORMATS,
	DECIMAL_SEPARATORS,
	SEPARATOR_CHARACTERS,
	THOUSANDS_SEPARATORS,
	type Preferences
} from 'src/types/PreferencesTypes';

/**
 * The defaults every preference falls back to, and the reading of whatever the configuration file happens to hold.
 *
 * **Nothing here refuses a file.** A preference is not ledger data: it belongs to the installation, and a value that is missing,
 * out of range or a shape nobody wrote reads as that preference's default rather than as a reason to stop. That is the opposite
 * of how the ledger reader treats an unrecognised value, and deliberately so — one is the user's data and the other is a setting
 * that has a sensible value to fall back to.
 */

export const DEFAULT_PREFERENCES: Preferences = {
	dateFormat: 'DD/MM/YYYY',
	decimalSeparator: 'comma',
	thousandsSeparator: 'dot',

	// 26%, as the fraction it names, in ten-thousandths
	defaultTaxRate: 2600,
	priceStalenessDays: 30,
	pensionRevaluationMonths: 3,
	receiptPendingMonths: 3,
	transferMatchWindowDays: 5,
	tradeMatchWindowDays: 5,
	backupCount: 10
};

const readChoice = <TValue extends string>(value: unknown, allowedValues: readonly TValue[], fallback: TValue): TValue => {
	return typeof value === 'string' && allowedValues.includes(value as TValue) ? value as TValue : fallback;
};

const readBoundedInteger = (value: unknown, minimum: number, maximum: number, fallback: number): number => {
	if(typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
		return fallback;
	}

	return value;
};

/**
 * Reads the preferences out of whatever was parsed from the configuration file.
 * @param value The raw value the file held, or undefined when there was no readable file at all.
 * @returns Every preference, each either the value the file held or its default.
 */
export const parsePreferences = (value: unknown): Preferences => {
	const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
	const decimalSeparator = readChoice(record.decimalSeparator, DECIMAL_SEPARATORS, DEFAULT_PREFERENCES.decimalSeparator);
	const thousandsSeparator = readChoice(record.thousandsSeparator, THOUSANDS_SEPARATORS, DEFAULT_PREFERENCES.thousandsSeparator);

	return {
		dateFormat: readChoice(record.dateFormat, DATE_FORMATS, DEFAULT_PREFERENCES.dateFormat),
		decimalSeparator,

		// The two separators must differ, and a file holding a pair that collides falls back to the default thousands separator
		thousandsSeparator: SEPARATOR_CHARACTERS[thousandsSeparator] === SEPARATOR_CHARACTERS[decimalSeparator] ?
			DEFAULT_PREFERENCES.thousandsSeparator :
			thousandsSeparator,
		defaultTaxRate: readBoundedInteger(record.defaultTaxRate, 0, 10000, DEFAULT_PREFERENCES.defaultTaxRate),
		priceStalenessDays: readBoundedInteger(record.priceStalenessDays, 1, Number.MAX_SAFE_INTEGER, DEFAULT_PREFERENCES.priceStalenessDays),
		pensionRevaluationMonths: readBoundedInteger(record.pensionRevaluationMonths, 1, Number.MAX_SAFE_INTEGER, DEFAULT_PREFERENCES.pensionRevaluationMonths),
		receiptPendingMonths: readBoundedInteger(record.receiptPendingMonths, 1, Number.MAX_SAFE_INTEGER, DEFAULT_PREFERENCES.receiptPendingMonths),
		transferMatchWindowDays: readBoundedInteger(record.transferMatchWindowDays, 0, 31, DEFAULT_PREFERENCES.transferMatchWindowDays),
		tradeMatchWindowDays: readBoundedInteger(record.tradeMatchWindowDays, 0, 31, DEFAULT_PREFERENCES.tradeMatchWindowDays),
		backupCount: readBoundedInteger(record.backupCount, 1, 100, DEFAULT_PREFERENCES.backupCount)
	};
};
