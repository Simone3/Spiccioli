import { useState, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { Pager } from 'src/components/common/Pager';
import { RowMenu } from 'src/components/common/RowMenu';
import { PriceForm, type PriceFormValues } from 'src/components/investments/PriceForm';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { FIRST_PRICE_PAGE, priceHistoryPage, priceHistoryPageCount, priceHistoryPageHolding } from 'src/logic/investments/Securities';
import type { IsoDate, Price, Security } from 'src/types/LedgerTypes';

/**
 * One security's whole price history, and the only place a price is deleted.
 *
 * **The history is newest first — the opposite of every other table in the application** — because the record anybody is looking
 * for here is the most recent one, and **it pages**, the pager being the same five controls the transactions list is walked with.
 * The panel opens on the first page for the same reason the list is turned round, and a security chosen in the table beside it is
 * a different history and lands there too.
 *
 * **Every edit a user makes sets the source to `manual`**, an edit to the value and an edit to the date alike, so a fetched
 * figure somebody has corrected stops claiming to be the provider's. Changing the date **moves** the record, replacing whatever
 * occupied the day it lands on, and **neither edit is confirmed**; deleting is, like every delete in the application.
 *
 * **This panel and the form it opens are the whole of what a user does to a price**, the *Update prices* pass above it aside.
 */

// The record a form is open on. An undefined record is one being recorded; an undefined draft is a form that is not open.
interface PriceDraft {
	price: Price | undefined;
}

export interface PriceHistoryPanelProps {
	security: Security;

	// The security's prices, already newest first
	prices: readonly Price[];

	// Writes what the form holds: a new record, or the one being corrected, moved to the day it now carries
	onSave: (original: Price | undefined, values: PriceFormValues) => void;

	onDelete: (price: Price) => void;
	onClose: () => void;
}

/**
 * The price history panel.
 * @param props The panel's props.
 * @param props.security The security the history belongs to.
 * @param props.prices Its prices, newest first.
 * @param props.onSave What saving the form does.
 * @param props.onDelete What deleting one does.
 * @param props.onClose What closing the panel does.
 * @returns The panel.
 */
export const PriceHistoryPanel = ({ security, prices, onSave, onDelete, onClose }: PriceHistoryPanelProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const [ priceDraft, setPriceDraft ] = useState<PriceDraft | undefined>(undefined);
	const [ priceToDelete, setPriceToDelete ] = useState<Price | undefined>(undefined);

	// The most recent records, which is where the panel opens however it was reached. A history that has shrunk under the page in
	// view is read at its last page rather than at an empty one.
	const [ requestedPage, setRequestedPage ] = useState(FIRST_PRICE_PAGE);

	// The day a save has just written, which the panel follows to whatever page it landed on: a record written while another page
	// was in view would otherwise be recorded and never seen. Turning the page by hand is what stops following it.
	const [ followed, setFollowed ] = useState<IsoDate | undefined>(undefined);

	const pageCount = priceHistoryPageCount(prices.length);
	const page = Math.min(followed === undefined ? requestedPage : priceHistoryPageHolding(prices, followed), pageCount);
	const rows = priceHistoryPage(prices, page);

	const turnTo = (next: number): void => {
		setFollowed(undefined);
		setRequestedPage(next);
	};

	const savePrice = (values: PriceFormValues): void => {
		onSave(priceDraft?.price, values);
		setPriceDraft(undefined);
		setFollowed(values.date);
	};

	const columns: readonly DataTableColumn<Price>[] = [
		{
			key: 'date',
			header: t('prices.columns.date'),
			numeric: true,
			render: (price) => {
				return formatter.storedDate(price.date);
			}
		},
		{
			key: 'value',
			header: t('prices.columns.value'),
			numeric: true,
			render: (price) => {
				return formatter.unitPrice(price.value);
			}
		},
		{
			key: 'source',
			header: t('prices.columns.source'),
			render: (price) => {
				return <Chip tone={price.source === 'fetched' ? 'provenance' : 'quiet'}>{t(`prices.sources.${price.source}`)}</Chip>;
			}
		},
		{
			key: 'actions',
			header: '',
			render: (price) => {
				return (
					<RowMenu
						label={t('prices.rowMenu', { date: formatter.storedDate(price.date) })}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									setPriceDraft({ price });
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									setPriceToDelete(price);
								}
							}
						]}/>
				);
			}
		}
	];

	const oldest = prices[prices.length - 1];
	const newest = prices[0];
	const footer = prices.length === 0 ?
		undefined :
		t('prices.footer', {
			count: t('prices.heading', { count: prices.length }),
			range: t('prices.range', { from: formatter.storedDate(oldest.date), to: formatter.storedDate(newest.date) })
		});

	return (
		<aside className='investments-screen-detail' aria-label={t('prices.table')}>
			<div className='investments-screen-detail-head'>
				<div>
					<b>{security.ticker}</b>
					<span className='investments-screen-detail-subtitle'>
						{t('securities.option', { ticker: security.isin, name: security.name })}
					</span>
				</div>
				<AppButton variant='ghost' onClick={onClose}>{t('dialog.cancel')}</AppButton>
			</div>

			<div className='investments-screen-detail-actions'>
				<h3 className='investments-screen-subhead'>{t('prices.heading', { count: prices.length })}</h3>
				<AppButton
					onClick={() => {
						setPriceDraft({ price: undefined });
					}}>
					{t('prices.add')}
				</AppButton>
			</div>

			{prices.length === 0 ?
				<p className='investments-screen-note'>{t('prices.empty')}</p> :
				<>
					<DataTable
						columns={columns}
						rows={rows}
						label={t('prices.table')}
						footer={footer}
						getRowKey={(price) => {
							return price.date;
						}}/>
					<Pager page={page} pageCount={pageCount} onChange={turnTo}/>
				</>}

			{priceDraft && (
				<PriceForm
					security={security}
					price={priceDraft.price}
					onSave={savePrice}
					onCancel={() => {
						setPriceDraft(undefined);
					}}/>
			)}

			{priceToDelete && (
				<ConfirmDialog
					danger
					title={t('prices.deleteTitle')}
					message={t('prices.deleteMessage', {
						date: formatter.storedDate(priceToDelete.date),
						value: formatter.unitPrice(priceToDelete.value)
					})}
					confirmLabel={t('prices.deleteConfirm')}
					onConfirm={() => {
						onDelete(priceToDelete);
						setPriceToDelete(undefined);
					}}
					onCancel={() => {
						setPriceToDelete(undefined);
					}}/>
			)}
		</aside>
	);
};
