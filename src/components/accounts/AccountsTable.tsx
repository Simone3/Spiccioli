import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isAccountClosed, isCashAccountType, type AccountUsage } from 'src/logic/accounts/Accounts';
import type { Account, Institution, LedgerId } from 'src/types/LedgerTypes';

/**
 * Every account ever opened, in the order the specification fixes, with the two counts that say whether a row can be deleted.
 *
 * **Five columns are em-dashed on the types that cannot carry them**: a `Brokerage` account has no opening balance and no
 * transactions, every cash account has no trades, every type but `Pension fund` has no exit tax, and a `Cash` account has no
 * institution. An em dash here is a field that cannot be filled rather than one nobody got round to.
 *
 * **There is no balance column.** Balances are what the Portfolio screen is for.
 */

export interface AccountsTableProps {

	// Already in the order of the specification: institution, then opening date, then name, with the closed ones last
	accounts: readonly Account[];

	institutions: ReadonlyMap<LedgerId, Institution>;
	usage: ReadonlyMap<LedgerId, AccountUsage>;

	// What the screen states above the table, which the footer repeats with the two totals after it
	summary: string;

	onEdit: (account: Account) => void;
	onDelete: (account: Account) => void;
}

/**
 * The accounts table.
 * @param props The table's props.
 * @param props.accounts The accounts, ordered.
 * @param props.institutions The institutions, by id.
 * @param props.usage What points at each account.
 * @param props.summary What the screen states about what it is showing.
 * @param props.onEdit What correcting a row does.
 * @param props.onDelete What deleting a row does.
 * @returns The table.
 */
export const AccountsTable = ({ accounts, institutions, usage, summary, onEdit, onDelete }: AccountsTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	// A column the row's type cannot carry, which is a field that cannot be filled rather than a figure that is missing
	const notApplicable = <span className='accounts-screen-not-applicable'>{t('table.notApplicable')}</span>;

	const countOf = (account: Account): AccountUsage => {
		return usage.get(account.id) ?? { transactions: 0, trades: 0 };
	};

	const columns: readonly DataTableColumn<Account>[] = [
		{
			key: 'name',
			header: t('accounts.columns.name'),
			render: (account) => {
				return account.name;
			}
		},
		{
			key: 'institution',
			header: t('accounts.columns.institution'),
			render: (account): ReactNode => {
				const institution = account.institutionId === null ? undefined : institutions.get(account.institutionId);

				return institution ? institution.name : notApplicable;
			}
		},
		{
			key: 'type',
			header: t('accounts.columns.type'),
			render: (account) => {
				return <Chip tone='quiet'>{t(`accounts.types.${account.type}`)}</Chip>;
			}
		},
		{
			key: 'openingBalance',
			header: t('accounts.columns.openingBalance'),
			numeric: true,
			render: (account): ReactNode => {
				return isCashAccountType(account.type) ? formatter.amount(account.openingBalance) : notApplicable;
			}
		},
		{
			key: 'exitTax',
			header: t('accounts.columns.exitTax'),
			numeric: true,
			render: (account): ReactNode => {
				return account.exitTaxRate === null ? notApplicable : formatter.percentage(account.exitTaxRate);
			}
		},
		{
			key: 'openingDate',
			header: t('accounts.columns.opened'),
			numeric: true,
			render: (account) => {
				return formatter.storedDate(account.openingDate);
			}
		},
		{
			key: 'closingDate',
			header: t('accounts.columns.closed'),
			numeric: true,
			render: (account): ReactNode => {
				return account.closingDate === null ? notApplicable : formatter.storedDate(account.closingDate);
			}
		},
		{
			key: 'transactions',
			header: t('accounts.columns.transactions'),
			numeric: true,
			render: (account): ReactNode => {
				return isCashAccountType(account.type) ? formatter.integer(countOf(account).transactions) : notApplicable;
			}
		},
		{
			key: 'trades',
			header: t('accounts.columns.trades'),
			numeric: true,
			render: (account): ReactNode => {
				return isCashAccountType(account.type) ? notApplicable : formatter.integer(countOf(account).trades);
			}
		},
		{
			key: 'notes',
			header: t('accounts.columns.notes'),
			render: (account) => {
				return <span className='accounts-screen-notes'>{account.notes}</span>;
			}
		},
		{
			key: 'actions',
			header: '',
			render: (account) => {
				return (
					<RowMenu
						label={t('accounts.rowMenu', { name: account.name })}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									onEdit(account);
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									onDelete(account);
								}
							}
						]}/>
				);
			}
		}
	];

	const totals = accounts.reduce((running, account) => {
		const counts = countOf(account);

		return {
			transactions: running.transactions + counts.transactions,
			trades: running.trades + counts.trades
		};
	}, { transactions: 0, trades: 0 });

	const footer = t('accounts.footer', {
		summary,
		transactions: t('accounts.transactionCount', { count: totals.transactions }),
		trades: t('accounts.tradeCount', { count: totals.trades })
	});

	return (
		<DataTable
			columns={columns}
			rows={accounts}
			label={t('accounts.table')}
			footer={footer}
			getRowKey={(account) => {
				return account.id;
			}}
			getRowClassName={(account) => {
				return isAccountClosed(account) ? 'accounts-screen-row-closed' : undefined;
			}}/>
	);
};
