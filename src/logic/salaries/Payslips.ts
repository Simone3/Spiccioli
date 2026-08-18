import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type { Cents, LedgerId, Payslip } from 'src/types/LedgerTypes';

/**
 * Everything pure about a payslip: which contract and which year it belongs to, the order the table shows it in, and the one
 * figure the record does not store.
 *
 * **A month is not a key.** A month may hold several payslips — the *tredicesima* is a second December row with a label — so
 * the ordering carries the label behind the month, with the unlabelled row first. The payslip table is scoped to one year, so
 * the year is not part of that ordering; the two places payslips are walked across years put it in front.
 *
 * **`netSalary` is the only derived field on a payslip**, and it is derived here rather than stored, like every other figure in
 * the application. It is exact: three amounts in cents added and subtracted, with no division anywhere near it.
 */

// A month is written with both its digits wherever it is written on its own, the table's column included
const MONTH_DIGITS = 2;

/**
 * Writes the period a payslip is for: its month, and the label behind it where it carries one.
 *
 * **This is how a payslip is named wherever it is named away from its own table** — in the *Matched* column of [§5.1] and in
 * everything checks 4 and 5 report — the table itself being scoped to one year and needing no year in the cell.
 * @param payslip The payslip.
 * @param translator The wording the month and the label are joined with.
 * @returns The month and the label, in one string.
 */
export const formatPayslipPeriod = (payslip: Payslip, translator: SpiccioliTranslator): string => {
	const month = translator.t('payslips.monthOfYear', {
		month: String(payslip.month).padStart(MONTH_DIGITS, '0'),
		year: String(payslip.year)
	});

	return payslip.label === null ? month : translator.t('payslips.periodWithLabel', { month, label: payslip.label });
};

/**
 * The one figure a payslip does not store: what the month was actually worth, with the reimbursements taken back out of it and
 * the car put back into it.
 * @param payslip The payslip.
 * @returns netPayment − refunds + carPayment, in cents.
 */
export const netSalary = (payslip: Payslip): Cents => {
	return payslip.netPayment - payslip.refunds + payslip.carPayment;
};

/**
 * Keeps the payslips of one contract, no figure anywhere in the application summing across contracts.
 * @param payslips The payslips.
 * @param contractId The contract the screen is scoped to.
 * @returns Its payslips, in the order they arrived in.
 */
export const payslipsOfContract = (payslips: readonly Payslip[], contractId: LedgerId): Payslip[] => {
	return payslips.filter((payslip) => {
		return payslip.contractId === contractId;
	});
};

/**
 * Groups a contract's payslips by the year the pay is for, which is what the per-year table counts and totals.
 * @param payslips The payslips of one contract.
 * @returns The payslips by year, each group in the order it arrived in.
 */
export const groupPayslipsByYear = (payslips: readonly Payslip[]): Map<number, Payslip[]> => {
	const byYear = new Map<number, Payslip[]>();

	for(const payslip of payslips) {
		const group = byYear.get(payslip.year);

		if(group) {
			group.push(payslip);
		}
		else {
			byYear.set(payslip.year, [ payslip ]);
		}
	}

	return byYear;
};

/**
 * Orders the payslips of one year the one way the table shows them: by month, then by label with the unlabelled row first.
 *
 * The identity breaks the last tie, so two December rows carrying the same label are still in a fixed order and the table does
 * not shuffle under a re-render.
 * @param payslips The payslips of one year.
 * @returns The payslips, ordered.
 */
export const sortPayslipsOfYear = (payslips: readonly Payslip[]): Payslip[] => {
	return [ ...payslips ].sort((first, second) => {
		if(first.month !== second.month) {
			return first.month - second.month;
		}

		const firstLabel = first.label ?? '';
		const secondLabel = second.label ?? '';

		if(firstLabel !== secondLabel) {
			// The unlabelled row is first, an empty label sorting before every other one
			return firstLabel < secondLabel ? -1 : 1;
		}

		return first.id < second.id ? -1 : 1;
	});
};
