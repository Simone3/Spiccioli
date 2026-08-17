import type { DateFormat } from 'src/types/PreferencesTypes';

/**
 * Printing a day the way the preferences say a day is printed.
 *
 * **The format comes from the preferences and never from a system locale.** The three the application offers are the three that
 * are unambiguous to write down, one per order, and the separator inside each is part of the format rather than a choice of its
 * own.
 */

const padded = (value: number, length = 2): string => {
	return String(value).padStart(length, '0');
};

/**
 * Prints a day.
 * @param date The day. Only its calendar fields are read; there is no time and no time zone in any of the three formats.
 * @param dateFormat Which of the three the preferences hold.
 * @returns The day as text.
 */
export const formatDate = (date: Date, dateFormat: DateFormat): string => {
	const year = padded(date.getFullYear(), 4);
	const month = padded(date.getMonth() + 1);
	const day = padded(date.getDate());

	switch(dateFormat) {
		case 'MM/DD/YYYY':
			return `${month}/${day}/${year}`;
		case 'YYYY-MM-DD':
			return `${year}-${month}-${day}`;
		case 'DD/MM/YYYY':
		default:
			return `${day}/${month}/${year}`;
	}
};

/**
 * Prints the time of day, which is what the save state says: "Saved 14:32".
 * @param date The moment.
 * @returns The time, on a 24-hour clock.
 */
export const formatTimeOfDay = (date: Date): string => {
	return `${padded(date.getHours())}:${padded(date.getMinutes())}`;
};

/**
 * Prints a day and the time of day, which the recent-file list is the only thing that needs.
 * The clock is always 24-hour: none of the three date formats carries a 12-hour convention, and neither does anything else here.
 * @param date The moment.
 * @param dateFormat Which of the three the preferences hold.
 * @returns The moment as text.
 */
export const formatDateAndTime = (date: Date, dateFormat: DateFormat): string => {
	return `${formatDate(date, dateFormat)} ${formatTimeOfDay(date)}`;
};
