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
 * The twelve months as an Italian payroll form prints them, which two parts of the template below are built out of.
 *
 * **They are written once and joined into both patterns**, so the month a period is read as and the month an expense claim is
 * named for can never come to disagree about what the twelve are.
 */
const ITALIAN_MONTHS = [
	'GENNAIO',
	'FEBBRAIO',
	'MARZO',
	'APRILE',
	'MAGGIO',
	'GIUGNO',
	'LUGLIO',
	'AGOSTO',
	'SETTEMBRE',
	'OTTOBRE',
	'NOVEMBRE',
	'DICEMBRE'
] as const;

/**
 * Reply's Italian payslip, which is the `Mod. Cedolino TS` form TeamSystem's payroll prints.
 *
 * **The form is a grid of boxes and not a list of figures.** A band of headings is printed across the page and the figures sit
 * in a row underneath it, each under the heading it belongs to — so the three figures the form states outright are found by
 * their headings: the monthly contract pay under `RETRIBUZIONE DI FATTO`, the gross under `TOTALE LORDO`, and what was actually
 * paid under `NETTO BUSTA`.
 *
 * **The other five are lines of the entry table**, the one headed `DESCRIZIONE VOCE`, where every movement of the month is
 * printed one to a line under a label of its own. **Which of that table's three money columns a line's figure sits in is the
 * whole of what it means**: `COMPETENZE` is paid to the employee, `TRATTENUTE` is withheld from them, and `DATI STATISTICI` is
 * what the employer paid elsewhere on their behalf. The three are printed identically and are told apart by position alone,
 * which is why the column each one is read from is declared here.
 *
 * **Expenses** are claimed a month in arrears, so the line names the month they were spent in: `NOTA SPESE SETTEMBRE` on an
 * October payslip. It is money paid over, so it is a `COMPETENZE` line.
 *
 * **The car is withheld under two labels**: the standing charge for having one, and a fine that was paid for the employee and
 * is being taken back. Both are the same field and a month may print either or both, so every line that matches is summed.
 *
 * **The pension fund is credited from two sides.** The employee's share is withheld from the pay and is a `TRATTENUTE` line;
 * the employer's share never passes through the pay at all, so it is printed among the `DATI STATISTICI` — as is the severance
 * credited into the fund the same month.
 *
 * **No label is read.** The form prints no name for a month that carries an extra payment, so that field opens empty and is
 * typed like any other ([§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)).
 */
const REPLY_ITALY: PayslipTemplate = {
	id: 'reply-italy',
	source: { kind: 'pdf' },

	// The band under "MESE RETRIBUITO", which opens the line the month and the year are the first two things on
	period: {
		pattern: new RegExp(`^(${ITALIAN_MONTHS.join('|')})\\s+(\\d{4})\\b`, 'u'),
		monthGroup: 1,
		yearGroup: 2,
		monthNames: ITALIAN_MONTHS
	},
	table: /^DESCRIZIONE VOCE$/u,
	figures: {
		contractGross: { in: 'box', heading: /^RETRIBUZIONE DI FATTO$/u },
		gross: { in: 'box', heading: /^TOTALE LORDO$/u },
		netPayment: { in: 'box', heading: /^NETTO BUSTA$/u },
		refunds: {
			in: 'table',
			label: new RegExp(`\\bNOTA SPESE (?:${ITALIAN_MONTHS.join('|')})\\b`, 'u'),
			column: /^COMPETENZE$/u
		},
		carPayment: { in: 'table', label: /\b(?:TRATTENUTA USO AUTO|ADDEBITO MULTE)/u, column: /^TRATTENUTE$/u },
		employeeContribution: { in: 'table', label: /\bFONDO C\/DIPE/u, column: /^TRATTENUTE$/u },
		employerContribution: { in: 'table', label: /\bFONDO C\/AZIENDA/u, column: /^DATI STATISTICI$/u },
		severanceContribution: { in: 'table', label: /\bCONTRIBUZIONE TFR/u, column: /^DATI STATISTICI$/u }
	},
	format: { decimalSeparator: 'comma', thousandsSeparator: 'dot' }
};

export const PAYSLIP_TEMPLATES: readonly PayslipTemplate[] = [ REPLY_ITALY ];

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
