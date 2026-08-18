import type { ReactElement, ReactNode } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { DateField } from 'src/components/common/DateField';
import { EditableCell } from 'src/components/common/EditableCell';
import { AmountField, PriceField, QuantityField } from 'src/components/common/NumericFields';
import { RowMenu } from 'src/components/common/RowMenu';
import { TextField } from 'src/components/common/TextField';
import { SecurityPicker } from 'src/components/investments/SecurityPicker';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import { tradeTotal, type WorkingAmount } from 'src/logic/investments/Trades';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Cents, Institution, IsoDate, LedgerId, Security, TenThousandths, Trade, TradeKind } from 'src/types/LedgerTypes';

/**
 * The trades themselves, one table for both tabs.
 *
 * **Sales carry three columns Purchases does not**: the tax the broker actually withheld, entered from the trade confirmation;
 * *Net proceeds* in place of *Total cost*; and the realised gain, which is the only figure on either tab that is neither entered
 * nor a restatement of what was.
 *
 * **Every column but the derived ones is edited where it sits.** `kind` is not among them: a purchase and a sale are two tabs
 * and a trade never moves between them, so there is nothing on the row that could change it.
 *
 * ***Matched* shows the date of the bank transaction the trade was paired with**, and an em dash is what checks 6 and 7 report.
 */

// The smallest quantity and the smallest price a field admits, in the ten-thousandths both are stored in
const SMALLEST_QUANTITY = 1;

const SMALLEST_PRICE = 1;

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

	// Called with what a committed cell changed
	onEdit: (trade: Trade, changes: Partial<Trade>) => void;

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
 * @param props.onEdit What a committed cell does.
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
				return (
					<EditableCell<IsoDate | undefined>
						value={trade.date}
						label={t('trades.edit.date', rowLabels(trade))}
						renderEditor={(value, onChange) => {
							return <DateField value={value} label={t('trades.columns.date')} required onChange={onChange}/>;
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(trade, { date: value });

							return undefined;
						}}>
						{formatter.storedDate(trade.date)}
					</EditableCell>
				);
			}
		},
		{
			key: 'security',
			header: t('trades.columns.security'),
			render: (trade) => {
				return (
					<EditableCell<LedgerId | undefined>
						value={trade.securityId}
						label={t('trades.edit.security', rowLabels(trade))}
						renderEditor={(value, onChange) => {
							return (
								<SecurityPicker
									value={value}
									label={t('trades.columns.security')}
									placeholder={t('trades.form.securityChoose')}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(trade, { securityId: value });

							return undefined;
						}}>
						{tickerOf(trade)}
					</EditableCell>
				);
			}
		},
		{
			key: 'account',
			header: t('trades.columns.account'),
			render: (trade) => {
				const account = accounts.get(trade.accountId);

				return (
					<EditableCell<LedgerId | undefined>
						value={trade.accountId}
						label={t('trades.edit.account', rowLabels(trade))}
						renderEditor={(value, onChange) => {
							return (
								<AccountPicker
									side='brokerage'
									value={value}
									label={t('trades.columns.account')}
									placeholder={t('trades.form.accountChoose')}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(trade, { accountId: value });

							return undefined;
						}}>
						<span className='investments-screen-quiet'>
							{account ? formatAccountName(account, institutions, translator) : ''}
						</span>
					</EditableCell>
				);
			}
		},
		{
			key: 'quantity',
			header: t('trades.columns.quantity'),
			numeric: true,
			render: (trade) => {
				return (
					<EditableCell<TenThousandths | undefined>
						value={trade.quantity}
						label={t('trades.edit.quantity', rowLabels(trade))}
						renderEditor={(value, onChange) => {
							return (
								<QuantityField
									value={value}
									label={t('trades.columns.quantity')}
									required
									minimum={SMALLEST_QUANTITY}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							if(value === undefined || value <= 0) {
								return t('field.required');
							}

							onEdit(trade, { quantity: value });

							return undefined;
						}}>
						{formatter.quantity(trade.quantity)}
					</EditableCell>
				);
			}
		},
		{
			key: 'unitPrice',
			header: t('trades.columns.unitPrice'),
			numeric: true,
			render: (trade) => {
				return (
					<EditableCell<TenThousandths | undefined>
						value={trade.unitPrice}
						label={t('trades.edit.unitPrice', rowLabels(trade))}
						renderEditor={(value, onChange) => {
							return (
								<PriceField
									value={value}
									label={t('trades.columns.unitPrice')}
									required
									minimum={SMALLEST_PRICE}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(trade, { unitPrice: value });

							return undefined;
						}}>
						{formatter.unitPrice(trade.unitPrice)}
					</EditableCell>
				);
			}
		},
		{
			key: 'fees',
			header: t('trades.columns.fees'),
			numeric: true,
			render: (trade) => {
				return (
					<EditableCell<Cents | undefined>
						value={trade.fees}
						label={t('trades.edit.fees', rowLabels(trade))}
						renderEditor={(value, onChange) => {
							return <AmountField value={value} label={t('trades.columns.fees')} required minimum={0} onChange={onChange}/>;
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(trade, { fees: value });

							return undefined;
						}}>
						{formatter.amount(trade.fees)}
					</EditableCell>
				);
			}
		},
		isSale ?
			{
				key: 'taxes',
				header: t('trades.columns.taxes'),
				numeric: true,
				render: (trade) => {
					return (
						<EditableCell<Cents | undefined>
							value={trade.taxes}
							label={t('trades.edit.taxes', rowLabels(trade))}
							renderEditor={(value, onChange) => {
								return <AmountField value={value} label={t('trades.columns.taxes')} required minimum={0} onChange={onChange}/>;
							}}
							onCommit={(value) => {
								if(value === undefined) {
									return t('field.required');
								}

								onEdit(trade, { taxes: value });

								return undefined;
							}}>
							{formatter.amount(trade.taxes)}
						</EditableCell>
					);
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
				return (
					<EditableCell<string>
						value={trade.notes}
						label={t('trades.edit.notes', rowLabels(trade))}
						renderEditor={(value, onChange) => {
							return (
								<TextField
									value={value}
									label={t('trades.columns.notes')}
									placeholder={t('form.optional')}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							onEdit(trade, { notes: value.trim() });

							return undefined;
						}}>
						<span className='investments-screen-quiet'>{trade.notes || t('trades.noNotes')}</span>
					</EditableCell>
				);
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
