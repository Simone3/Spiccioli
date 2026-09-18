import type { PayslipTemplate } from 'src/logic/import/PayslipTemplate';

/**
 * The payslip templates the application ships, which are the whole of what *Import payslip* offers.
 *
 * **A template is code and not configuration** ([§15](../../../docs/functional/specs/15-out-of-scope.md)), the same as the bank
 * templates beside it: there is no editor, no mapping screen and no template file on disk, and the way a new one arrives is a
 * new version of the application. A payroll provider prints the same document every month for years and then changes it
 * without saying so, and a template that can be edited is a template that gets pointed at the wrong line.
 *
 * **What a template is named is not here.** Every string a user reads lives in the translation bundle, so a template carries an
 * id and the screen looks its name up by it.
 */

/**
 * The sample payslip, which is the shape `scripts/write-sample-payslips.js` writes.
 *
 * **It is an invented employer's document and not anybody's**, so that the shape can be exercised end to end — the chooser, the
 * reader, the template and the form that opens filled in — without a real payslip, which is somebody's pay, ever being needed
 * to do it. It prints each figure on the line that names it, a period line above them, and a name for the month only where
 * there is one to print, which is what an ordinary payslip does.
 */
const SAMPLE: PayslipTemplate = {
	id: 'sample',
	source: { kind: 'pdf' },
	period: { pattern: /^Period:\s*(\d{1,2})\s*\/\s*(\d{4})$/u, monthGroup: 1, yearGroup: 2 },
	label: /^Extra payment:\s*(.+)$/u,
	figures: {
		contractGross: /^Contract gross\s+(.+)$/u,
		gross: /^Gross total\s+(.+)$/u,
		netPayment: /^Net payment\s+(.+)$/u,
		refunds: /^Expense refunds\s+(.+)$/u,
		carPayment: /^Company car\s+(.+)$/u,
		employeeContribution: /^Pension fund - employee\s+(.+)$/u,
		employerContribution: /^Pension fund - employer\s+(.+)$/u,
		severanceContribution: /^Severance \(TFR\)\s+(.+)$/u
	},
	format: { decimalSeparator: 'comma', thousandsSeparator: 'dot' }
};

export const PAYSLIP_TEMPLATES: readonly PayslipTemplate[] = [ SAMPLE ];

/**
 * Finds a template by the id a picker hands back.
 * @param id The id.
 * @returns The template, or undefined where nothing ships under that id.
 */
export const findPayslipTemplate = (id: string): PayslipTemplate | undefined => {
	return PAYSLIP_TEMPLATES.find((template) => {
		return template.id === id;
	});
};
