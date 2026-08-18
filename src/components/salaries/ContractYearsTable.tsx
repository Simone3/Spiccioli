import type { ReactElement, ReactNode } from 'react';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { EditableCell } from 'src/components/common/EditableCell';
import { IntegerField } from 'src/components/common/NumericFields';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SalaryYearFigures } from 'src/logic/salaries/SalaryFigures';

/**
 * The per-year table: one row per calendar year the contract covers, always visible and always complete.
 *
 * **The rows come from the contract's own dates and not from the payslips**, so a year in the middle with nothing recorded in it
 * is a row of zeros rather than a missing row. Choosing a row is what swaps the payslip table under it.
 *
 * **`Working days` is not a column that reports a record — it *is* the record.** Typing a number into the cell creates the
 * ContractYear, and clearing it deletes it, putting the year back exactly where it was before anything was typed. That delete is
 * the one in the application that is not confirmed, the cell being the whole of it. **A year without one reads *undefined* in the
 * two hourly columns** rather than zero or a dash: the rate cannot be computed, which is not the same as being nothing.
 *
 * **Working days are always the whole calendar year**, never the part worked, so a partial first or last year understates both
 * hourly figures. That is accepted rather than corrected.
 */

// The bounds of the validation specification: a day of the year, and a leap year's worth of them
const WORKING_DAYS_RANGE = { minimum: 1, maximum: 366 };

export interface ContractYearsTableProps {

	// One row per year the contract covers, ascending
	years: readonly SalaryYearFigures[];

	// Which year's payslips are showing under the table. A row is always selected.
	selectedYear: number;

	onSelectYear: (year: number) => void;

	// Writes the ContractYear, or deletes it where the cell was cleared. Returns the reason it was refused, where it was.
	onWriteWorkingDays: (year: number, workingDays: number | undefined) => string | undefined;
}

/**
 * The per-year table.
 * @param props The table's props.
 * @param props.years The rows, ascending.
 * @param props.selectedYear Which year's payslips are showing.
 * @param props.onSelectYear What choosing a row does.
 * @param props.onWriteWorkingDays What typing into the working-days cell does.
 * @returns The table.
 */
export const ContractYearsTable = ({
	years,
	selectedYear,
	onSelectYear,
	onWriteWorkingDays
}: ContractYearsTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	// A rate that cannot be computed is stated as such: the divisor was never entered, so there is no figure and no zero
	const hourlyCell = (value: number | undefined): ReactElement | string => {
		return value === undefined ? <span className='salaries-screen-quiet'>{t('table.undefined')}</span> : formatter.amount(value);
	};

	const columns: readonly DataTableColumn<SalaryYearFigures>[] = [
		{
			key: 'year',
			header: t('payslips.yearColumns.year'),
			render: (row) => {
				return (
					<button
						type='button'
						className='salaries-screen-link'
						aria-label={t('payslips.selectYear', { year: String(row.year) })}
						onClick={() => {
							onSelectYear(row.year);
						}}>
						{row.year}
					</button>
				);
			}
		},
		{
			key: 'payslipCount',
			header: t('payslips.yearColumns.payslipCount'),
			numeric: true,
			render: (row) => {
				return formatter.integer(row.payslipCount);
			}
		},
		{
			key: 'yearContractGross',
			header: t('payslips.yearColumns.yearContractGross'),
			numeric: true,
			render: (row) => {
				return formatter.amount(row.yearContractGross);
			}
		},
		{
			key: 'totalGross',
			header: t('payslips.yearColumns.totalGross'),
			numeric: true,
			render: (row) => {
				return formatter.amount(row.totalGross);
			}
		},
		{
			key: 'totalNetSalary',
			header: t('payslips.yearColumns.totalNetSalary'),
			numeric: true,
			render: (row) => {
				return formatter.amount(row.totalNetSalary);
			}
		},
		{
			key: 'workingDays',
			header: t('payslips.yearColumns.workingDays'),
			numeric: true,
			render: (row) => {
				return (
					<EditableCell<number | undefined>
						value={row.workingDays}
						label={t('payslips.editWorkingDays', { year: String(row.year) })}
						renderEditor={(value, onChange) => {
							return (
								<IntegerField
									value={value}
									label={t('payslips.yearColumns.workingDays')}
									minimum={WORKING_DAYS_RANGE.minimum}
									maximum={WORKING_DAYS_RANGE.maximum}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							return onWriteWorkingDays(row.year, value);
						}}>
						{row.workingDays === undefined ?
							<span className='salaries-screen-quiet'>{t('table.notApplicable')}</span> :
							formatter.integer(row.workingDays)}
					</EditableCell>
				);
			}
		},
		{
			key: 'grossPerHour',
			header: t('payslips.yearColumns.grossPerHour'),
			numeric: true,
			render: (row) => {
				return hourlyCell(row.grossPerHour);
			}
		},
		{
			key: 'netPerHour',
			header: t('payslips.yearColumns.netPerHour'),
			numeric: true,
			render: (row) => {
				return hourlyCell(row.netPerHour);
			}
		}
	];

	const payslipCount = years.reduce((running, row) => {
		return running + row.payslipCount;
	}, 0);

	const missingDays = years.filter((row) => {
		return row.workingDays === undefined;
	}).length;

	// The caveat goes under the counts because it is what the two hourly columns have to be read against
	const footer = ((): ReactNode => {
		return (
			<>
				<div>
					{t('payslips.yearFooter', {
						years: t('contracts.yearCount', { count: years.length }),
						payslips: t('contracts.payslipCount', { count: payslipCount }),
						days: missingDays === 0 ? t('payslips.workingDaysComplete') : t('payslips.workingDaysMissing', { count: missingDays })
					})}
				</div>
				<div className='salaries-screen-note'>{t('payslips.workingDaysHint')}</div>
			</>
		);
	})();

	return (
		<DataTable
			columns={columns}
			rows={years}
			label={t('payslips.yearTable')}
			footer={footer}
			getRowKey={(row) => {
				return String(row.year);
			}}
			getRowClassName={(row) => {
				return row.year === selectedYear ? 'salaries-screen-row-selected' : undefined;
			}}/>
	);
};
