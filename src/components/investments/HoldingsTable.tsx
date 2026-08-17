import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { DateField } from 'src/components/common/DateField';
import { EditableCell } from 'src/components/common/EditableCell';
import { PriceField } from 'src/components/common/NumericFields';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import { isPriceStale } from 'src/logic/investments/Securities';
import type { Holding } from 'src/logic/investments/Holdings';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Account, Institution, IsoDate, LedgerId, Security, TenThousandths } from 'src/types/LedgerTypes';

/**
 * The holdings: one row per (security, brokerage account) holding a position, every figure derived and every column read-only
 * **except the price**.
 *
 * **This is where prices are kept up to date.** The price cell opens an inline editor — a value and an as-of date defaulting to
 * today — and saving writes a Price record, replacing whatever that day already held. Nothing is confirmed, and the editor shows
 * the value the chosen day currently holds where it holds one. **A price belongs to the security and not to a holding**, so the
 * same instrument held at two institutions is two rows and one price, and the editor says so.
 *
 * **A date older than the staleness threshold is marked in the cell itself**: the date is the thing that has gone wrong, so the
 * date is what is marked, and the row says *how* stale rather than only *that* it is. **A security with no price at all is marked
 * more loudly** — its price cell reads *none*, its *Last priced* an em dash, its value nothing and its gain minus everything the
 * position cost. The em dash is not marked: there is no date to age, and the price cell has already said so.
 *
 * The table is **gross** throughout: market price, no tax, no fees. The net counterpart is the Portfolio headline.
 */

// The lowest price this field admits, in the ten-thousandths a price is stored in
const SMALLEST_PRICE = 1;

/** What the inline editor holds: a value, and the day it is as of. */
export interface HoldingPriceEdit {
	value: TenThousandths | undefined;
	date: IsoDate | undefined;
}

export interface HoldingsTableProps {

	// The holdings, already ordered by ticker and then by account name
	holdings: readonly Holding[];

	securities: ReadonlyMap<LedgerId, Security>;
	accounts: ReadonlyMap<LedgerId, Account>;
	institutions: ReadonlyMap<LedgerId, Institution>;

	// Which holding's detail panel is open beside the table
	selected: Holding | undefined;

	// What a security's given day currently holds, which is what the editor opens on
	priceOn: (securityId: LedgerId, date: IsoDate) => TenThousandths | undefined;

	// The day the editor defaults to
	today: IsoDate;

	footer: ReactNode;
	onSelect: (holding: Holding) => void;
	onWritePrice: (securityId: LedgerId, date: IsoDate, value: TenThousandths) => void;
}

/**
 * The holdings table.
 * @param props The table's props.
 * @param props.holdings The rows.
 * @param props.securities The securities, by id.
 * @param props.accounts The accounts, by id.
 * @param props.institutions The institutions, by id.
 * @param props.selected Which row's detail is open.
 * @param props.priceOn What a security's given day holds.
 * @param props.today The day the editor defaults to.
 * @param props.footer What goes under the rule.
 * @param props.onSelect What choosing a row does.
 * @param props.onWritePrice What recording a price does.
 * @returns The table.
 */
export const HoldingsTable = ({
	holdings,
	securities,
	accounts,
	institutions,
	selected,
	priceOn,
	today,
	footer,
	onSelect,
	onWritePrice
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
					<EditableCell<HoldingPriceEdit>
						value={{ value: priceOn(holding.securityId, today), date: today }}
						label={t('holdings.editPrice', { security: tickerOf(holding) })}
						renderEditor={(edit, onChange) => {
							return (
								<div className='investments-screen-price-editor'>
									<PriceField
										value={edit.value}
										label={t('holdings.priceValue')}
										required
										minimum={SMALLEST_PRICE}
										onChange={(value) => {
											onChange({ ...edit, value });
										}}/>
									<DateField
										value={edit.date}
										label={t('holdings.priceDate')}
										required
										onChange={(date) => {
											// The editor shows what the chosen day currently holds, which is the record a save would replace
											onChange({ date, value: date === undefined ? undefined : priceOn(holding.securityId, date) });
										}}/>
									<p className='investments-screen-note'>{t('holdings.priceNote')}</p>
								</div>
							);
						}}
						onCommit={(edit) => {
							if(edit.value === undefined || edit.date === undefined) {
								return t('field.required');
							}

							if(edit.value <= 0) {
								return t('holdings.priceMustBePositive');
							}

							onWritePrice(holding.securityId, edit.date, edit.value);

							return undefined;
						}}>
						{holding.price === undefined ?
							<span className='investments-screen-nothing'>{t('holdings.noPrice')}</span> :
							formatter.unitPrice(holding.price)}
					</EditableCell>
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
