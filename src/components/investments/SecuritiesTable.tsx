import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SecurityPosition } from 'src/logic/investments/Holdings';
import { isPriceStale, type SecurityUsage } from 'src/logic/investments/Securities';
import type { LedgerId, Price, Security } from 'src/types/LedgerTypes';

/**
 * The securities, by ticker, with what is held of each one across every brokerage account.
 *
 * **Securities no longer held are in the list like everything else**, marked by an em dash in *Held* and sorted nowhere special.
 * **A security oversold in any account reads an em dash too, tinted**: no holding is derived for that (security, account) at all,
 * so there is no quantity to state and none is invented — not for the broken account and not for the others, a partial sum
 * reading as the position. One dash means nothing is held, the other means nothing can be said.
 *
 * *Trades* is what decides whether a security can be deleted; *Prices* does not, the history going with it.
 *
 * ***Last priced* is the day the newest price in that history is as of, and it is marked where check 3 would name the security**:
 * held, and either priced longer ago than the threshold in the preferences or never priced at all. The date is the thing that
 * has gone stale, so the date is what is marked, and the row says *how* stale rather than only *that* it is; a security nobody
 * has ever priced reads an em dash marked the same way, the check making no distinction between the two and neither does this.
 * **Nothing is marked on a security that is not held**: its price is an input to no figure, so an old one is not a fault.
 */

export interface SecuritiesTableProps {

	// The securities, already ordered by ticker
	securities: readonly Security[];

	usage: ReadonlyMap<LedgerId, SecurityUsage>;

	// What is held of each one, and whether anything can be said about it
	positions: ReadonlyMap<LedgerId, SecurityPosition>;

	// The most recent price of each one, and no entry at all for a security that has never been priced
	latestPrices: ReadonlyMap<LedgerId, Price>;

	// Which security's price history is open beside the table
	selectedId: LedgerId | undefined;

	footer: ReactNode;
	onSelect: (security: Security) => void;
	onEdit: (security: Security) => void;
	onDelete: (security: Security) => void;
}

/**
 * The securities table.
 * @param props The table's props.
 * @param props.securities The securities, ordered.
 * @param props.usage What points at each one.
 * @param props.positions What is held of each one.
 * @param props.latestPrices The newest price of each one.
 * @param props.selectedId Which one's history is open.
 * @param props.footer What goes under the rule.
 * @param props.onSelect What choosing a row does.
 * @param props.onEdit What correcting one does.
 * @param props.onDelete What deleting one does.
 * @returns The table.
 */
export const SecuritiesTable = ({
	securities,
	usage,
	positions,
	latestPrices,
	selectedId,
	footer,
	onSelect,
	onEdit,
	onDelete
}: SecuritiesTableProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const { preferences } = usePreferences();

	// Whether a quantity is actually held, which is what makes a price matter and what check 3 goes over
	const isHeld = (security: Security): boolean => {
		const position = positions.get(security.id);

		return position !== undefined && !position.oversold && position.quantity > 0;
	};

	const heldCell = (security: Security): ReactNode => {
		const position = positions.get(security.id);

		if(position?.oversold) {
			return <span className='investments-screen-oversold' title={t('securities.oversold')}>{t('table.notApplicable')}</span>;
		}

		if(!position || position.quantity <= 0) {
			return <span className='investments-screen-quiet'>{t('table.notApplicable')}</span>;
		}

		return formatter.quantity(position.quantity);
	};

	const lastPricedCell = (security: Security): ReactNode => {
		const latest = latestPrices.get(security.id);
		const held = isHeld(security);

		if(!latest) {
			return held ?
				<span className='investments-screen-stale' title={t('securities.neverPriced')}>{t('table.notApplicable')}</span> :
				<span className='investments-screen-quiet'>{t('table.notApplicable')}</span>;
		}

		const stale = held && isPriceStale(latest.date, preferences.priceStalenessDays);

		return (
			<span
				className={stale ? 'investments-screen-stale' : 'investments-screen-quiet'}
				title={stale ? t('securities.stalePrice') : undefined}>
				{formatter.storedDate(latest.date)}
			</span>
		);
	};

	const columns: readonly DataTableColumn<Security>[] = [
		{
			key: 'ticker',
			header: t('securities.columns.ticker'),
			render: (security) => {
				return (
					<button
						type='button'
						className='investments-screen-link'
						aria-label={t('securities.select', { ticker: security.ticker })}
						onClick={() => {
							onSelect(security);
						}}>
						{security.ticker}
						<span className='investments-screen-quiet'>{security.name}</span>
					</button>
				);
			}
		},
		{
			key: 'isin',
			header: t('securities.columns.isin'),
			render: (security) => {
				return <span className='investments-screen-quiet'>{security.isin}</span>;
			}
		},
		{
			key: 'exchange',
			header: t('securities.columns.exchange'),
			render: (security) => {
				return t(`exchanges.${security.exchange}`);
			}
		},
		{
			key: 'type',
			header: t('securities.columns.type'),
			render: (security) => {
				return <Chip tone='quiet'>{t(`securityTypes.${security.type}`)}</Chip>;
			}
		},
		{
			key: 'taxRate',
			header: t('securities.columns.taxRate'),
			numeric: true,
			render: (security) => {
				return formatter.percentage(security.taxRate);
			}
		},
		{
			key: 'held',
			header: t('securities.columns.held'),
			numeric: true,
			render: heldCell
		},
		{
			key: 'trades',
			header: t('securities.columns.trades'),
			numeric: true,
			render: (security) => {
				return <span className='investments-screen-quiet'>{formatter.integer(usage.get(security.id)?.trades ?? 0)}</span>;
			}
		},
		{
			key: 'prices',
			header: t('securities.columns.prices'),
			numeric: true,
			render: (security) => {
				return <span className='investments-screen-quiet'>{formatter.integer(usage.get(security.id)?.prices ?? 0)}</span>;
			}
		},
		{
			key: 'lastPriced',
			header: t('securities.columns.lastPriced'),
			numeric: true,
			render: lastPricedCell
		},
		{
			key: 'actions',
			header: '',
			render: (security) => {
				return (
					<RowMenu
						label={t('securities.rowMenu', { ticker: security.ticker })}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									onEdit(security);
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									onDelete(security);
								}
							}
						]}/>
				);
			}
		}
	];

	return (
		<DataTable
			columns={columns}
			rows={securities}
			label={t('securities.table')}
			footer={footer}
			getRowKey={(security) => {
				return security.id;
			}}
			getRowClassName={(security) => {
				return security.id === selectedId ? 'investments-screen-row-selected' : undefined;
			}}/>
	);
};
