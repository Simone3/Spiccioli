import { DateUtils } from 'src/framework/utils/DateUtils';
import type { IsoDate } from 'src/types/LedgerTypes';

/**
 * The day arithmetic the matchers, the checks and the net worth line are written in.
 *
 * **Every window in the matching of [§11.6] opens on the leading record's date**, and each of these takes a day the file holds
 * and produces the other end of a window, the distance to a counterpart or the age of a record. Only the transfer window reaches
 * backwards, which is a negative count of days rather than anything new here. They work on stored `YYYY-MM-DD` days rather than
 * on `Date`, because that is what every comparison downstream is: two stored days compare as text, and nothing here ever needs a
 * time or a zone.
 *
 * **“Today” is the computer's own clock**, read at the moment a figure is computed and never cached, so it is passed in rather
 * than read here.
 */

// The three parts of a stored day, which is what the month windows are built out of
const MONTH_DIGITS = 2;

/**
 * Moves a stored day forwards or backwards by a number of days.
 * @param date The day.
 * @param days How many days to move by. Negative moves backwards.
 * @returns The day it lands on.
 */
export const addDaysToIsoDate = (date: IsoDate, days: number): IsoDate => {
	const day = DateUtils.fromStandardYearMonthDay(date);

	return day ? DateUtils.toStandardYearMonthDay(DateUtils.addDays(day, days)) : date;
};

/**
 * Moves a stored day forwards or backwards by a number of months, clamping to the last day of the month it lands in.
 * @param date The day.
 * @param months How many months to move by. Negative moves backwards.
 * @returns The day it lands on.
 */
export const addMonthsToIsoDate = (date: IsoDate, months: number): IsoDate => {
	const day = DateUtils.fromStandardYearMonthDay(date);

	return day ? DateUtils.toStandardYearMonthDay(DateUtils.addMonths(day, months)) : date;
};

/**
 * Counts the whole days between two stored days, which is the age every check states.
 * @param from The earlier day.
 * @param to The later day, which is today wherever an age is being stated.
 * @returns How many days separate them, negative when the second is before the first.
 */
export const daysBetweenIsoDates = (from: IsoDate, to: IsoDate): number => {
	const start = DateUtils.fromStandardYearMonthDay(from);
	const end = DateUtils.fromStandardYearMonthDay(to);

	return start && end ? DateUtils.dayDifference(start, end) : 0;
};

/**
 * The first day of a month, which is where a payslip's window opens and the point its distances are measured from.
 * A payslip has no date of its own, so this is what stands in for one.
 * @param year The year.
 * @param month The month, from 1.
 * @returns The first day of that month.
 */
export const firstDayOfMonth = (year: number, month: number): IsoDate => {
	return `${String(year).padStart(4, '0')}-${String(month).padStart(MONTH_DIGITS, '0')}-01`;
};

/**
 * The last day of a month, which is where every point of the net worth line but the final one falls.
 * @param year The year.
 * @param month The month, from 1.
 * @returns The last day of that month.
 */
export const lastDayOfMonth = (year: number, month: number): IsoDate => {
	// The zeroth day of the month after is the last day of this one, whatever its length
	return DateUtils.toStandardYearMonthDay(new Date(year, month, 0));
};

/**
 * The last day of the month after a month, which is where a payslip's window closes: a month's pay is paid in its own month or
 * in the one after it.
 * @param year The year.
 * @param month The month, from 1.
 * @returns The last day of the following month.
 */
export const lastDayOfNextMonth = (year: number, month: number): IsoDate => {
	return lastDayOfMonth(year, month + 1);
};
