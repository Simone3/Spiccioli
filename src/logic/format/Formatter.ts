import { formatDate, formatDateAndTime, formatTimeOfDay } from 'src/logic/format/DateFormat';
import { formatAmount, formatInteger, formatPercentage, formatQuantity, formatUnitPrice, type SeparatorCharacters } from 'src/logic/format/NumberFormat';
import { SEPARATOR_CHARACTERS, type Preferences } from 'src/types/PreferencesTypes';

/**
 * Every way a figure or a day reaches the screen, bound once to the preferences in force.
 *
 * A screen never reads a separator or a date format itself: it takes this and calls it. That is what makes changing a
 * preference re-render every figure in the application immediately — the formatter is derived from the preferences, so a new
 * one arrives with them.
 */

export interface Formatter {

	// The two characters, for the one control that needs the character rather than the formatting: the amount field
	separators: SeparatorCharacters;

	amount: (cents: number, explicitSign?: boolean) => string;
	unitPrice: (tenThousandths: number) => string;
	quantity: (tenThousandths: number) => string;
	percentage: (fraction: number) => string;
	integer: (value: number) => string;
	date: (date: Date) => string;
	dateAndTime: (date: Date) => string;

	// The clock alone, which the save state is the only thing that reads
	timeOfDay: (date: Date) => string;
}

/**
 * Binds every formatter to the preferences in force.
 * @param preferences The preferences.
 * @returns The formatter every screen reads.
 */
export const createFormatter = (preferences: Preferences): Formatter => {
	const separators: SeparatorCharacters = {
		decimal: SEPARATOR_CHARACTERS[preferences.decimalSeparator],
		thousands: SEPARATOR_CHARACTERS[preferences.thousandsSeparator]
	};

	return {
		separators,
		amount: (cents, explicitSign) => {
			return formatAmount(cents, separators, explicitSign);
		},
		unitPrice: (tenThousandths) => {
			return formatUnitPrice(tenThousandths, separators);
		},
		quantity: (tenThousandths) => {
			return formatQuantity(tenThousandths, separators);
		},
		percentage: (fraction) => {
			return formatPercentage(fraction, separators);
		},
		integer: (value) => {
			return formatInteger(value, separators);
		},
		date: (date) => {
			return formatDate(date, preferences.dateFormat);
		},
		dateAndTime: (date) => {
			return formatDateAndTime(date, preferences.dateFormat);
		},
		timeOfDay: (date) => {
			return formatTimeOfDay(date);
		}
	};
};
