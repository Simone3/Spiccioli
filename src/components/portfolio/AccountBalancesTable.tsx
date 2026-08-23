import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { HintNote } from 'src/components/common/HintNote';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isAccountClosed } from 'src/logic/accounts/Accounts';
import type { WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, narrowFromWorkingScale, narrowPartsFromWorkingScale } from 'src/logic/money/Money';
import { hasGrossBalance } from 'src/logic/portfolio/NetWorth';
import type { Account, Institution, LedgerId } from 'src/types/LedgerTypes';

/**
 * Every account with its computed balance, in the order of [§4.1], totalling to the headline.
 *
 * **This and the Accounts screen are the two places every account is shown together, and neither filters.** It is read-only:
 * accounts are created, edited and closed on the Accounts screen, whose table carries no balance column — each of the two shows
 * the stored record or the computed figure, and neither shows both.
 *
 * **Five columns and no more.** The institution having a column of its own makes this one of the three places an account is not
 * written *Institution · Account*: the account column names the account alone, and a `Cash` account shows an em dash beside it.
 *
 * **The two balance columns are the same figures before and after [§11.3]**, and each carries a note of its own. The net one is
 * the column on the screen whose figure means three different things depending on the row it is in, and closed accounts are
 * computed like any other, which is the reason it totals to the headline.
 *
 * **Only two account types have a gross figure that differs from their balance**, so the other six show a dash rather than the
 * same number twice — and **the gross total counts them all the same**, which is what makes the difference between the two
 * totals exactly the hypothetical tax and sell fee. The gross column therefore does not add up to the total under it, and its
 * note is what says so.
 *
 * **Each column totals as printed and not only at the working scale.** A brokerage row is the one kind that carries a fraction
 * of a cent, its holdings' figures being products, so the balances are narrowed against their total rather than each on its own
 * — which leaves every exact row alone, those having given up nothing in their own rounding.
 */

export interface AccountBalancesTableProps {

	// Already in the order of the specification: institution, then opening date, then name, with the closed ones last
	accounts: readonly Account[];

	institutions: ReadonlyMap<LedgerId, Institution>;

	// One entry per account, at the working scale
	balances: ReadonlyMap<LedgerId, WorkingAmount>;

	// The same one entry per account, before the hypothetical tax and sell fee, the six types that carry no haircut included
	grossBalances: ReadonlyMap<LedgerId, WorkingAmount>;

	// What the table says about what it is showing, under the rule
	summary: string;

	// The headline, which is what the net column totals to
	total: WorkingAmount;

	// The same total before [§11.3], which counts every account and not only the ones that print a figure
	grossTotal: WorkingAmount;
}

/**
 * The breakdown by account.
 * @param props The table's props.
 * @param props.accounts The accounts, ordered.
 * @param props.institutions The institutions, by id.
 * @param props.balances Every account's computed balance.
 * @param props.grossBalances Every account's balance before the hypothetical tax and sell fee.
 * @param props.summary What the footer states under the rule.
 * @param props.total The headline.
 * @param props.grossTotal What the portfolio is worth before [§11.3].
 * @returns The table.
 */
export const AccountBalancesTable = ({
	accounts,
	institutions,
	balances,
	grossBalances,
	summary,
	total,
	grossTotal
}: AccountBalancesTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	// The rows are narrowed together, so a column adds up to the total under it rather than to a cent either side of it
	const narrowAgainstTotal = (figures: ReadonlyMap<LedgerId, WorkingAmount>): ReadonlyMap<LedgerId, number> => {
		return new Map(narrowPartsFromWorkingScale(accounts.map((account) => {
			return figures.get(account.id) ?? 0;
		}), MONEY_SCALES.amount).map((amount, index) => {
			return [ accounts[index].id, amount ];
		}));
	};

	const rowAmounts = narrowAgainstTotal(balances);
	const grossRowAmounts = narrowAgainstTotal(grossBalances);

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
			key: 'grossBalance',
			header: (
				<>
					{t('portfolio.accounts.columns.grossBalance')}
					<HintNote align='right'>{t('portfolio.notes.grossBalance')}</HintNote>
				</>
			),
			numeric: true,
			total: formatter.amount(narrowFromWorkingScale(grossTotal, MONEY_SCALES.amount)),
			render: (account): ReactNode => {
				// Money already has no *before* of its own, so the column is one the row's type cannot carry rather than a repeat
				if(!hasGrossBalance(account)) {
					return <span className='portfolio-screen-quiet'>{t('table.notApplicable')}</span>;
				}

				return formatter.amount(grossRowAmounts.get(account.id) ?? 0);
			}
		},
		{
			key: 'netBalance',
			header: (
				<>
					{t('portfolio.accounts.columns.netBalance')}
					<HintNote align='right'>{t('portfolio.notes.netBalance')}</HintNote>
				</>
			),
			numeric: true,
			total: formatter.amount(narrowFromWorkingScale(total, MONEY_SCALES.amount)),
			render: (account) => {
				return formatter.amount(rowAmounts.get(account.id) ?? 0);
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
			totalLabel={t('portfolio.accounts.total')}
			footer={summary}/>
	);
};
