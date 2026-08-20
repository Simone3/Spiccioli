import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import { isPriceStale } from 'src/logic/investments/Securities';
import type { Holding } from 'src/logic/investments/Holdings';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Institution, LedgerId, Security } from 'src/types/LedgerTypes';

/**
 * The holdings: one row per (security, brokerage account) holding a position, and **every column derived and read-only**, the
 * price and its date included.
 *
 * **A price belongs to the security and not to a holding** — the same instrument held at two institutions is two rows and one
 * price — so this table states the price and the Securities tab is where it is kept. The price cell is the way there: it opens
 * that tab on this row's security, with the whole history and *Update prices* on it.
 *
 * **A date older than the staleness threshold is marked in the cell itself**: the date is the thing that has gone wrong, so the
 * date is what is marked, and the row says *how* stale rather than only *that* it is. **A security with no price at all is marked
 * differently rather than more loudly** — its price cell reads *none*, its *Last priced* an em dash, and its two money columns
 * read what the position cost and a gain of nothing, the row being carried at cost ([§11.3]). The em dash is not marked: there is
 * no date to age, and the price cell has already said so. **The money columns therefore look like a position that has gone
 * nowhere**, and what says otherwise is the price cell, check 3 and the banner behind it — a row cannot shout and a banner can.
 *
 * The table is **gross** throughout: market price, no tax, no fees. The net counterpart is the Portfolio headline.
 */

export interface HoldingsTableProps {

	// The holdings, already ordered by ticker and then by account name
	holdings: readonly Holding[];

	securities: ReadonlyMap<LedgerId, Security>;
	accounts: ReadonlyMap<LedgerId, Account>;
	institutions: ReadonlyMap<LedgerId, Institution>;

	// Which holding's detail panel is open beside the table
	selected: Holding | undefined;

	footer: ReactNode;
	onSelect: (holding: Holding) => void;

	// Opens the Securities tab on this row's security, which is where its prices are kept
	onManagePrices: (holding: Holding) => void;
}

/**
 * The holdings table.
 * @param props The table's props.
 * @param props.holdings The rows.
 * @param props.securities The securities, by id.
 * @param props.accounts The accounts, by id.
 * @param props.institutions The institutions, by id.
 * @param props.selected Which row's detail is open.
 * @param props.footer What goes under the rule.
 * @param props.onSelect What choosing a row does.
 * @param props.onManagePrices What the price cell does.
 * @returns The table.
 */
export const HoldingsTable = ({
	holdings,
	securities,
	accounts,
	institutions,
	selected,
	footer,
	onSelect,
	onManagePrices
}: HoldingsTableProps): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();
	const { preferences } = usePreferences();

	const tickerOf = (holding: Holding): string => {
		return securities.get(holding.securityId)?.ticker ?? '';
	};

	const lastPricedCell = (holding: Holding): ReactNode => {
		if(holding.priceDate === undefined) {
			return <span className='investments-screen-quiet'>{t('table.notApplicable')}</span>;
		}

		const stale = isPriceStale(holding.priceDate, preferences.priceStalenessDays);

		return (
			<span className={stale ? 'investments-screen-stale' : 'investments-screen-quiet'}>
				{formatter.storedDate(holding.priceDate)}
			</span>
		);
	};

	const gainCell = (holding: Holding): ReactNode => {
		const gain = narrowFromWorkingScale(holding.gain, MONEY_SCALES.amount);
		const figure = holding.gainPct === undefined ?
			formatter.amount(gain, true) :
			t('holdings.gainWithPercentage', { gain: formatter.amount(gain, true), percentage: formatter.percentage(holding.gainPct) });

		return <span className={gain < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>{figure}</span>;
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
			key: 'quantity',
			header: t('holdings.columns.quantity'),
			numeric: true,
			render: (holding) => {
				return formatter.quantity(holding.quantity);
			}
		},
		{
			key: 'avgCost',
			header: t('holdings.columns.avgCost'),
			numeric: true,
			render: (holding) => {
				return formatter.unitPrice(narrowFromWorkingScale(holding.avgCost, MONEY_SCALES.rate));
			}
		},
		{
			key: 'price',
			header: t('holdings.columns.price'),
			numeric: true,
			render: (holding) => {
				return (
					<button
						type='button'
						className='investments-screen-link investments-screen-link-figure'
						aria-label={t('holdings.managePrices', { security: tickerOf(holding) })}
						onClick={() => {
							onManagePrices(holding);
						}}>
						{holding.price === undefined ?
							<span className='investments-screen-nothing'>{t('holdings.noPrice')}</span> :
							formatter.unitPrice(holding.price)}
					</button>
				);
			}
		},
		{
			key: 'lastPriced',
			header: t('holdings.columns.lastPriced'),
			numeric: true,
			render: lastPricedCell
		},
		{
			key: 'value',
			header: t('holdings.columns.value'),
			numeric: true,
			render: (holding) => {
				return formatter.amount(narrowFromWorkingScale(holding.marketValue, MONEY_SCALES.amount));
			}
		},
		{
			key: 'gain',
			header: t('holdings.columns.gain'),
			numeric: true,
			render: gainCell
		}
	];

	return (
		<DataTable
			columns={columns}
			rows={holdings}
			label={t('holdings.table')}
			footer={footer}
			getRowKey={(holding) => {
				return `${holding.securityId}|${holding.accountId}`;
			}}
			getRowClassName={(holding) => {
				return selected && selected.securityId === holding.securityId && selected.accountId === holding.accountId ?
					'investments-screen-row-selected' :
					undefined;
			}}/>
	);
};
