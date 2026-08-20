import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import { positionKey, type Holding, type HoldingsTotals } from 'src/logic/investments/Holdings';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Institution, LedgerId, Security, TenThousandths } from 'src/types/LedgerTypes';

/**
 * The holdings: one row per (security, brokerage account) holding a position, and **every column derived and read-only**.
 *
 * **The table states what a position is worth and how it has done** — its value, its gain and its annualised return — and the
 * facts those are computed from are in the detail panel, one row's worth at a time. The quantity, the average cost and the
 * price are inputs to the two columns that matter, and a table read for its outcome does not spread them across nine columns.
 *
 * **A price belongs to the security and not to a holding** — the same instrument held at two institutions is two rows and one
 * price — so no row states one and no row links to one: the Securities tab is where prices are kept. **A security with no price
 * at all is carried at cost**, so its value reads what the position cost and its gain reads nothing ([§11.3]). **The row
 * therefore looks like a position that has gone nowhere**, and what says otherwise is check 3 and the banner behind it — a row
 * cannot shout and a banner can.
 *
 * **The last row is the totals row and it is a row**: every total sits in the column it totals. The two money columns are sums
 * and the annualised return is not — it is the portfolio-wide figure, computed from every trade in the file, and the positions
 * it leaves out are counted in the note under the table rather than in the cell.
 *
 * The table is **gross** throughout: market price, no tax, no fees. The net counterpart is the Portfolio headline.
 */

export interface HoldingsTableProps {

	// The holdings, already ordered by ticker and then by account name
	holdings: readonly Holding[];

	securities: ReadonlyMap<LedgerId, Security>;
	accounts: ReadonlyMap<LedgerId, Account>;
	institutions: ReadonlyMap<LedgerId, Institution>;

	// What each position has earned per year, by position key, with no entry where there is none to state
	returns: ReadonlyMap<string, TenThousandths | undefined>;

	totals: HoldingsTotals;

	// What the money in every trade in the file has earned per year, which is the one total that is not a sum
	portfolioReturn: TenThousandths | undefined;

	// Which holding's detail panel is open beside the table
	selected: Holding | undefined;

	footer: ReactNode;
	onSelect: (holding: Holding) => void;
}

/**
 * The holdings table.
 * @param props The table's props.
 * @param props.holdings The rows.
 * @param props.securities The securities, by id.
 * @param props.accounts The accounts, by id.
 * @param props.institutions The institutions, by id.
 * @param props.returns The annualised return of each position, by position key.
 * @param props.totals What the two money columns add up to.
 * @param props.portfolioReturn The portfolio-wide annualised return.
 * @param props.selected Which row's detail is open.
 * @param props.footer What goes under the rule.
 * @param props.onSelect What choosing a row does.
 * @returns The table.
 */
export const HoldingsTable = ({
	holdings,
	securities,
	accounts,
	institutions,
	returns,
	totals,
	portfolioReturn,
	selected,
	footer,
	onSelect
}: HoldingsTableProps): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();

	const tickerOf = (holding: Holding): string => {
		return securities.get(holding.securityId)?.ticker ?? '';
	};

	const signedAmount = (working: number, percentage: TenThousandths | undefined): ReactNode => {
		const cents = narrowFromWorkingScale(working, MONEY_SCALES.amount);
		const figure = percentage === undefined ?
			formatter.amount(cents, true) :
			t('holdings.gainWithPercentage', { gain: formatter.amount(cents, true), percentage: formatter.percentage(percentage) });

		return <span className={cents < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>{figure}</span>;
	};

	const returnCell = (rate: TenThousandths | undefined): ReactNode => {
		if(rate === undefined) {
			return <span className='investments-screen-quiet'>{t('table.undefined')}</span>;
		}

		return (
			<span className={rate < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>
				{formatter.percentage(rate)}
			</span>
		);
	};

	const columns: readonly DataTableColumn<Holding>[] = [
		{
			key: 'security',
			header: t('holdings.columns.security'),
			render: (holding) => {
				const security = securities.get(holding.securityId);

				return (
					<button
						type='button'
						className='investments-screen-link'
						aria-label={t('holdings.select', { security: tickerOf(holding) })}
						onClick={() => {
							onSelect(holding);
						}}>
						{tickerOf(holding)}
						<span className='investments-screen-quiet'>{security?.name ?? ''}</span>
					</button>
				);
			}
		},
		{
			key: 'type',
			header: t('holdings.columns.type'),
			render: (holding) => {
				const security = securities.get(holding.securityId);

				return security ? <Chip tone='quiet'>{t(`securityTypes.${security.type}`)}</Chip> : null;
			}
		},
		{
			key: 'account',
			header: t('holdings.columns.account'),
			render: (holding) => {
				const account = accounts.get(holding.accountId);

				return (
					<span className='investments-screen-quiet'>
						{account ? formatAccountName(account, institutions, translator) : ''}
					</span>
				);
			}
		},
		{
			key: 'value',
			header: t('holdings.columns.value'),
			numeric: true,
			total: formatter.amount(narrowFromWorkingScale(totals.value, MONEY_SCALES.amount)),
			render: (holding) => {
				return formatter.amount(narrowFromWorkingScale(holding.marketValue, MONEY_SCALES.amount));
			}
		},
		{
			key: 'gain',
			header: t('holdings.columns.gain'),
			numeric: true,
			total: signedAmount(totals.gain, totals.gainPct),
			render: (holding) => {
				return signedAmount(holding.gain, holding.gainPct);
			}
		},
		{
			key: 'annualisedReturn',
			header: t('holdings.columns.annualisedReturn'),
			numeric: true,
			total: returnCell(portfolioReturn),
			render: (holding) => {
				return returnCell(returns.get(positionKey(holding.securityId, holding.accountId)));
			}
		}
	];

	return (
		<DataTable
			columns={columns}
			rows={holdings}
			label={t('holdings.table')}
			totalLabel={t('holdings.total')}
			footer={footer}
			getRowKey={(holding) => {
				return positionKey(holding.securityId, holding.accountId);
			}}
			getRowClassName={(holding) => {
				return selected && selected.securityId === holding.securityId && selected.accountId === holding.accountId ?
					'investments-screen-row-selected' :
					undefined;
			}}/>
	);
};
