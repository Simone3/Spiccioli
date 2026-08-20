import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { netSalary } from 'src/logic/salaries/Payslips';
import { totalPayslips } from 'src/logic/salaries/SalaryFigures';
import type { Payslip } from 'src/types/LedgerTypes';

/**
 * The payslips of the selected year, by the month the pay is **for**.
 *
 * **A month may hold several rows.** The *tredicesima* is a second December row with a label rather than a synthetic thirteenth
 * month, which is why the ordering carries the label behind the month and puts the unlabelled row first.
 *
 * **Ten columns**: every stored field except the three the screen already carries — the identity, the contract in the selector
 * above and the year in the row selected in the per-year table — with **the three pension figures written into one column**,
 * because they are three credits into one place and reading them apart is what the fund's own statement is for. **The one
 * derived column is inserted rather than appended**: net salary sits immediately after the car, beside the three entered
 * figures it is made of, and that is the only departure from the order the domain model lists them in.
 *
 * **`Net payment` may be negative**, alone among the figures here: a December whose year-end tax recalculation exceeds the
 * month's net is a real payslip, and net salary follows it down.
 */

// A month is written with both of its digits wherever it is named
const MONTH_DIGITS = 2;

export interface PayslipsTableProps {

	// Already ordered by month, then by label with the unlabelled row first
	payslips: readonly Payslip[];

	// Which year the table is scoped to, which is what the month column writes beside each month
	year: number;

	onEdit: (payslip: Payslip) => void;
	onDuplicate: (payslip: Payslip) => void;
	onDelete: (payslip: Payslip) => void;
}

/**
 * Writes a payslip's month the one way it is written anywhere on this screen.
 *
 * **Both parts are handed over as text.** A year is an identifier and not a quantity, so it is never grouped: interpolating it
 * as a number would put a thousands separator through the middle of it.
 * @param payslip The payslip.
 * @param write How the wording puts a month and a year together.
 * @returns The month.
 */
export const formatPayslipMonth = (payslip: Payslip, write: (month: string, year: string) => string): string => {
	return write(String(payslip.month).padStart(MONTH_DIGITS, '0'), String(payslip.year));
};

/**
 * The payslip table.
 * @param props The table's props.
 * @param props.payslips The payslips of the year, ordered.
 * @param props.year The year the table is scoped to.
 * @param props.onEdit What correcting a row does.
 * @param props.onDuplicate What copying one does.
 * @param props.onDelete What deleting one does.
 * @returns The table.
 */
export const PayslipsTable = ({ payslips, year, onEdit, onDuplicate, onDelete }: PayslipsTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const monthOf = (payslip: Payslip): string => {
		return formatPayslipMonth(payslip, (month, ofYear) => {
			return t('payslips.monthOfYear', { month, year: ofYear });
		});
	};

	// A payslip with nothing under any of the three headings states the one zero rather than three of them
	const pensionFundCell = (payslip: Payslip): string => {
		const credits = [ payslip.employeeContribution, payslip.employerContribution, payslip.severanceContribution ];

		if(credits.every((credit) => {
			return credit === 0;
		})) {
			return formatter.amount(0);
		}

		return t('payslips.pensionFundSum', {
			employee: formatter.amount(payslip.employeeContribution),
			employer: formatter.amount(payslip.employerContribution),
			severance: formatter.amount(payslip.severanceContribution)
		});
	};

	// Every amount column is the same column: the stored figure, written as an amount and right-aligned on its decimal place
	const amountColumn = (key: string, header: string, figure: (payslip: Payslip) => number): DataTableColumn<Payslip> => {
		return {
			key,
			header,
			numeric: true,
			render: (payslip) => {
				return formatter.amount(figure(payslip));
			}
		};
	};

	const columns: readonly DataTableColumn<Payslip>[] = [
		{
			key: 'month',
			header: t('payslips.columns.month'),
			render: monthOf
		},
		{
			key: 'label',
			header: t('payslips.columns.label'),
			render: (payslip) => {
				return payslip.label === null ?
					<span className='salaries-screen-quiet'>{t('table.notApplicable')}</span> :
					<Chip tone='accent'>{payslip.label}</Chip>;
			}
		},
		amountColumn('contractGross', t('payslips.columns.contractGross'), (payslip) => {
			return payslip.contractGross;
		}),
		amountColumn('gross', t('payslips.columns.gross'), (payslip) => {
			return payslip.gross;
		}),
		amountColumn('netPayment', t('payslips.columns.netPayment'), (payslip) => {
			return payslip.netPayment;
		}),
		amountColumn('refunds', t('payslips.columns.refunds'), (payslip) => {
			return payslip.refunds;
		}),
		amountColumn('carPayment', t('payslips.columns.carPayment'), (payslip) => {
			return payslip.carPayment;
		}),

		// The one derived column, inserted here rather than appended: it sits beside the three figures it is made of
		amountColumn('netSalary', t('payslips.columns.netSalary'), netSalary),

		// The three credits are one column because they are one destination: the fund they reach separately
		{
			key: 'pensionFund',
			header: t('payslips.columns.pensionFund'),
			numeric: true,
			render: pensionFundCell
		},
		{
			key: 'notes',
			header: t('payslips.columns.notes'),
			render: (payslip) => {
				return <span className='salaries-screen-quiet'>{payslip.notes}</span>;
			}
		},
		{
			key: 'actions',
			header: '',
			render: (payslip) => {
				return (
					<RowMenu
						label={t('payslips.rowMenu', { month: monthOf(payslip) })}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									onEdit(payslip);
								}
							},
							{
								key: 'duplicate',
								label: t('rowMenu.duplicate'),
								onSelect: () => {
									onDuplicate(payslip);
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									onDelete(payslip);
								}
							}
						]}/>
				);
			}
		}
	];

	const footer = ((): ReactNode => {
		const totals = totalPayslips(payslips);

		return t('payslips.footer', {
			payslips: t('contracts.payslipCount', { count: payslips.length }),
			gross: formatter.amount(totals.gross),
			netPayment: formatter.amount(totals.netPayment),
			netSalary: formatter.amount(totals.netSalary),
			employee: formatter.amount(totals.employeeContribution),
			employer: formatter.amount(totals.employerContribution),
			severance: formatter.amount(totals.severanceContribution)
		});
	})();

	return (
		<DataTable
			columns={columns}
			rows={payslips}
			label={t('payslips.table', { year: String(year) })}
			footer={footer}
			getRowKey={(payslip) => {
				return payslip.id;
			}}/>
	);
};
