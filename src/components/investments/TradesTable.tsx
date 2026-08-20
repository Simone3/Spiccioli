import type { ReactElement, ReactNode } from 'react';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import { tradeTotal, type WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Institution, IsoDate, LedgerId, Security, Trade, TradeKind } from 'src/types/LedgerTypes';

/**
 * The trades themselves, one table for both tabs.
 *
 * **Sales carry three columns Purchases does not**: the tax the broker actually withheld, entered from the trade confirmation;
 * *Net proceeds* in place of *Total cost*; and the realised gain, which is the only figure on either tab that is neither entered
 * nor a restatement of what was.
 *
 * **A row is corrected in the form the row menu opens**, which is the form it was recorded on. `kind` is not on it: a purchase
 * and a sale are two tabs and a trade never moves between them, so there is nothing to change it with.
 *
 * ***Matched* shows the date of the bank transaction the trade was paired with**, and an em dash is what checks 6 and 7 report.
 */

export interface TradesTableProps {
	kind: TradeKind;

	// The trades the filters match, already ordered
	trades: readonly Trade[];

	securities: ReadonlyMap<LedgerId, Security>;
	accounts: ReadonlyMap<LedgerId, Account>;
	institutions: ReadonlyMap<LedgerId, Institution>;

	// The realised gain per sale, and no entry at all where there is none to state
	realisedGains: ReadonlyMap<LedgerId, WorkingAmount>;

	// The day the bank transaction each trade paired with is dated, and no entry at all where nothing paired with it
	matchedDates: ReadonlyMap<LedgerId, IsoDate>;

	footer: ReactNode;

	onEdit: (trade: Trade) => void;
	onDelete: (trade: Trade) => void;
}

/**
 * The trades table.
 * @param props The table's props.
 * @param props.kind Which of the two tabs is asking.
 * @param props.trades The rows.
 * @param props.securities The securities, by id.
 * @param props.accounts The accounts, by id.
 * @param props.institutions The institutions, by id.
 * @param props.realisedGains The realised gain per sale.
 * @param props.matchedDates The day the transaction each trade paired with is dated.
 * @param props.footer What goes under the rule.
 * @param props.onEdit What correcting a row does.
 * @param props.onDelete What deleting a row does.
 * @returns The table.
 */
export const TradesTable = ({
	kind,
	trades,
	securities,
	accounts,
	institutions,
	realisedGains,
	matchedDates,
	footer,
	onEdit,
	onDelete
}: TradesTableProps): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();
	const isSale = kind === 'sale';

	const tickerOf = (trade: Trade): string => {
		return securities.get(trade.securityId)?.ticker ?? '';
	};

	// What every cell's own control is called: which row it is on, said the way the row itself reads
	const rowLabels = (trade: Trade): { security: string; date: string } => {
		return { security: tickerOf(trade), date: formatter.storedDate(trade.date) };
	};

	const signedAmount = (working: WorkingAmount): ReactNode => {
		const cents = narrowFromWorkingScale(working, MONEY_SCALES.amount);

		return (
			<span className={cents < 0 ? 'investments-screen-negative' : 'investments-screen-positive'}>
				{formatter.amount(cents, true)}
			</span>
		);
	};

	const columns: readonly (DataTableColumn<Trade> | undefined)[] = [
		{
			key: 'date',
			header: t('trades.columns.date'),
			numeric: true,
			render: (trade) => {
				return formatter.storedDate(trade.date);
			}
		},
		{
			key: 'security',
			header: t('trades.columns.security'),
			render: tickerOf
		},
		{
			key: 'account',
			header: t('trades.columns.account'),
			render: (trade) => {
				const account = accounts.get(trade.accountId);

				return (
					<span className='investments-screen-quiet'>
						{account ? formatAccountName(account, institutions, translator) : ''}
					</span>
				);
			}
		},
		{
			key: 'quantity',
			header: t('trades.columns.quantity'),
			numeric: true,
			render: (trade) => {
				return formatter.quantity(trade.quantity);
			}
		},
		{
			key: 'unitPrice',
			header: t('trades.columns.unitPrice'),
			numeric: true,
			render: (trade) => {
				return formatter.unitPrice(trade.unitPrice);
			}
		},
		{
			key: 'fees',
			header: t('trades.columns.fees'),
			numeric: true,
			render: (trade) => {
				return formatter.amount(trade.fees);
			}
		},
		isSale ?
			{
				key: 'taxes',
				header: t('trades.columns.taxes'),
				numeric: true,
				render: (trade) => {
					return formatter.amount(trade.taxes);
				}
			} :
			undefined,
		{
			key: 'total',
			header: isSale ? t('trades.columns.netProceeds') : t('trades.columns.totalCost'),
			numeric: true,
			render: (trade) => {
				return formatter.amount(tradeTotal(trade));
			}
		},
		isSale ?
			{
				key: 'realisedGain',
				header: t('trades.columns.realisedGain'),
				numeric: true,
				render: (trade) => {
					const gain = realisedGains.get(trade.id);

					return gain === undefined ? <span className='investments-screen-quiet'>{t('table.undefined')}</span> : signedAmount(gain);
				}
			} :
			undefined,
		{
			key: 'matched',
			header: t('trades.columns.matched'),
			render: (trade) => {
				const date = matchedDates.get(trade.id);

				if(date === undefined) {
					return (
						<span className='investments-screen-quiet' aria-label={t('trades.matched.noneLabel')}>
							{t('trades.matched.none')}
						</span>
					);
				}

				return t('trades.matched.date', { date: formatter.storedDate(date) });
			}
		},
		{
			key: 'notes',
			header: t('trades.columns.notes'),
			render: (trade) => {
				return <span className='investments-screen-quiet'>{trade.notes || t('trades.noNotes')}</span>;
			}
		},
		{
			key: 'actions',
			header: '',
			render: (trade) => {
				return (
					<RowMenu
						label={t('trades.rowMenu', rowLabels(trade))}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									onEdit(trade);
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									onDelete(trade);
								}
							}
						]}/>
				);
			}
		}
	];

	return (
		<DataTable
			columns={columns.filter((column): column is DataTableColumn<Trade> => {
				return column !== undefined;
			})}
			rows={trades}
			label={isSale ? t('trades.tableSales') : t('trades.tablePurchases')}
			footer={footer}
			getRowKey={(trade) => {
				return trade.id;
			}}/>
	);
};
