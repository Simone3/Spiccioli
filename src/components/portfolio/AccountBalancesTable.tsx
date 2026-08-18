import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { HintNote } from 'src/components/common/HintNote';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isAccountClosed } from 'src/logic/accounts/Accounts';
import type { WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Institution, LedgerId } from 'src/types/LedgerTypes';

/**
 * Every account with its computed balance, in the order of [§4.1], totalling to the headline.
 *
 * **This and the Accounts screen are the two places every account is shown together, and neither filters.** It is read-only:
 * accounts are created, edited and closed on the Accounts screen, whose table carries no balance column — each of the two shows
 * the stored record or the computed figure, and neither shows both.
 *
 * **Four columns and no more.** The institution having a column of its own makes this one of the three places an account is not
 * written *Institution · Account*: the account column names the account alone, and a `Cash` account shows an em dash beside it.
 *
 * **The Balance column is the one column on the screen whose figure means three different things depending on the row it is in**,
 * which is what its note says — and closed accounts are computed like any other, which is the reason the column totals to the
 * headline.
 */

export interface AccountBalancesTableProps {

	// Already in the order of the specification: institution, then opening date, then name, with the closed ones last
	accounts: readonly Account[];

	institutions: ReadonlyMap<LedgerId, Institution>;

	// One entry per account, at the working scale
	balances: ReadonlyMap<LedgerId, WorkingAmount>;

	// What the table says about what it is showing, under the rule
	summary: string;

	// The headline, which is what the column totals to
	total: WorkingAmount;
}

/**
 * The breakdown by account.
 * @param props The table's props.
 * @param props.accounts The accounts, ordered.
 * @param props.institutions The institutions, by id.
 * @param props.balances Every account's computed balance.
 * @param props.summary What the footer states beside the total.
 * @param props.total The headline.
 * @returns The table.
 */
export const AccountBalancesTable = ({ accounts, institutions, balances, summary, total }: AccountBalancesTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const columns: readonly DataTableColumn<Account>[] = [
		{
			key: 'institution',
			header: t('portfolio.accounts.columns.institution'),
			render: (account): ReactNode => {
				const institution = account.institutionId === null ? undefined : institutions.get(account.institutionId);

				// A Cash account is money held by nobody, so the column is one that cannot be filled rather than one nobody filled
				return institution ? institution.name : <span className='portfolio-screen-quiet'>{t('table.notApplicable')}</span>;
			}
		},
		{
			key: 'account',
			header: t('portfolio.accounts.columns.account'),
			render: (account) => {
				return account.name;
			}
		},
		{
			key: 'type',
			header: t('portfolio.accounts.columns.type'),
			render: (account) => {
				return <Chip tone='quiet'>{t(`accounts.types.${account.type}`)}</Chip>;
			}
		},
		{
			key: 'balance',
			header: (
				<>
					{t('portfolio.accounts.columns.balance')}
					<HintNote align='right'>{t('portfolio.notes.balance')}</HintNote>
				</>
			),
			numeric: true,
			render: (account) => {
				return formatter.amount(narrowFromWorkingScale(balances.get(account.id) ?? 0, MONEY_SCALES.amount));
			}
		}
	];

	return (
		<DataTable
			columns={columns}
			rows={accounts}
			getRowKey={(account) => {
				return account.id;
			}}
			label={t('portfolio.accounts.table')}
			getRowClassName={(account) => {
				return isAccountClosed(account) ? 'portfolio-screen-row-closed' : undefined;
			}}
			footer={
				<div className='portfolio-screen-table-footer'>
					<span>{summary}</span>
					<span className='portfolio-screen-table-total'>
						{formatter.amount(narrowFromWorkingScale(total, MONEY_SCALES.amount))}
					</span>
				</div>
			}/>
	);
};
