import type { ReactElement } from 'react';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatMinorUnitsAsPlainDecimal, MONEY_SCALES } from 'src/logic/money/Money';
import type { Contract, LedgerId } from 'src/types/LedgerTypes';

/**
 * The contracts, one row per employer, with the payslip count that decides whether one can be deleted.
 *
 * **Months per year and hours per day are the denominators the other tab divides by**, which is why they have columns of their
 * own here and are stated again under the heading while the Payslips tab is showing.
 *
 * **A contract is never retired, only ended.** An end date is a fact about the contract and not a state that removes it: it
 * keeps its payslips, keeps its years and stays in the selector, and no total in the application changes when it is filled in.
 */

export interface ContractsTableProps {

	// Already ordered by start date, then by employer
	contracts: readonly Contract[];

	// How many payslips point at each contract, which is what blocks a deletion
	payslipCounts: ReadonlyMap<LedgerId, number>;

	// Which contract the Payslips tab is scoped to, marked here so the two tabs agree about what is selected
	selectedId: LedgerId | undefined;

	onSelect: (contract: Contract) => void;
	onEdit: (contract: Contract) => void;
	onDelete: (contract: Contract) => void;
}

/**
 * The contracts table.
 * @param props The table's props.
 * @param props.contracts The contracts, ordered.
 * @param props.payslipCounts How many payslips point at each.
 * @param props.selectedId Which one the other tab is scoped to.
 * @param props.onSelect What choosing a row does.
 * @param props.onEdit What correcting one does.
 * @param props.onDelete What deleting one does.
 * @returns The table.
 */
export const ContractsTable = ({
	contracts,
	payslipCounts,
	selectedId,
	onSelect,
	onEdit,
	onDelete
}: ContractsTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const columns: readonly DataTableColumn<Contract>[] = [
		{
			key: 'name',
			header: t('contracts.columns.name'),
			render: (contract) => {
				return (
					<button
						type='button'
						className='salaries-screen-link'
						aria-label={t('contracts.select', { name: contract.name })}
						onClick={() => {
							onSelect(contract);
						}}>
						{contract.name}
					</button>
				);
			}
		},
		{
			key: 'monthsPerYear',
			header: t('contracts.columns.monthsPerYear'),
			numeric: true,
			render: (contract) => {
				return formatter.integer(contract.monthsPerYear);
			}
		},
		{
			key: 'hoursPerDay',
			header: t('contracts.columns.hoursPerDay'),
			numeric: true,
			render: (contract) => {
				return formatMinorUnitsAsPlainDecimal(contract.hoursPerDay, MONEY_SCALES.hundredths, formatter.separators.decimal);
			}
		},
		{
			key: 'startDate',
			header: t('contracts.columns.startDate'),
			numeric: true,
			render: (contract) => {
				return formatter.storedDate(contract.startDate);
			}
		},
		{
			key: 'endDate',
			header: t('contracts.columns.endDate'),
			numeric: true,
			render: (contract) => {
				return contract.endDate === null ?
					<span className='salaries-screen-quiet'>{t('table.notApplicable')}</span> :
					formatter.storedDate(contract.endDate);
			}
		},
		{
			key: 'payslips',
			header: t('contracts.columns.payslips'),
			numeric: true,
			render: (contract) => {
				return <span className='salaries-screen-quiet'>{formatter.integer(payslipCounts.get(contract.id) ?? 0)}</span>;
			}
		},
		{
			key: 'notes',
			header: t('contracts.columns.notes'),
			render: (contract) => {
				return <span className='salaries-screen-quiet'>{contract.notes}</span>;
			}
		},
		{
			key: 'actions',
			header: '',
			render: (contract) => {
				return (
					<RowMenu
						label={t('contracts.rowMenu', { name: contract.name })}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									onEdit(contract);
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									onDelete(contract);
								}
							}
						]}/>
				);
			}
		}
	];

	const endedCount = contracts.filter((contract) => {
		return contract.endDate !== null;
	}).length;

	const totalPayslips = contracts.reduce((running, contract) => {
		return running + (payslipCounts.get(contract.id) ?? 0);
	}, 0);

	const footer = t('contracts.footer', {
		contracts: t('contracts.count', { count: contracts.length }),
		ended: endedCount === 0 ? t('contracts.endedNone') : t('contracts.ended', { count: endedCount }),
		payslips: t('contracts.payslipCount', { count: totalPayslips })
	});

	return (
		<DataTable
			columns={columns}
			rows={contracts}
			label={t('contracts.table')}
			footer={footer}
			getRowKey={(contract) => {
				return contract.id;
			}}
			getRowClassName={(contract) => {
				return contract.id === selectedId ? 'salaries-screen-row-selected' : undefined;
			}}/>
	);
};
