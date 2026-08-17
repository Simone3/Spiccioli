import { useState, type ReactElement } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { Chip } from 'src/components/common/Chip';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { DateField } from 'src/components/common/DateField';
import { EditableCell } from 'src/components/common/EditableCell';
import { PriceField } from 'src/components/common/NumericFields';
import { RowMenu } from 'src/components/common/RowMenu';
import { PriceForm, type PriceFormValues } from 'src/components/investments/PriceForm';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { IsoDate, Price, Security, TenThousandths } from 'src/types/LedgerTypes';

/**
 * One security's whole price history, and the only place a price is deleted.
 *
 * **The history is newest first — the opposite of every other table in the application** — because the record anybody is looking
 * for here is the most recent one.
 *
 * **Every edit a user makes sets the source to `manual`**, an edit to the value and an edit to the date alike, so a fetched
 * figure somebody has corrected stops claiming to be the provider's. Editing a date **moves** the record, replacing whatever
 * occupied the day it lands on, and **neither edit is confirmed**; deleting is, like every delete in the application.
 */

// The lowest price this field admits, in the ten-thousandths a price is stored in
const SMALLEST_PRICE = 1;

export interface PriceHistoryPanelProps {
	security: Security;

	// The security's prices, already newest first
	prices: readonly Price[];

	// Records a price against a day, replacing whatever that day held
	onWrite: (price: Price) => void;

	// Moves a record to another day, replacing whatever that day held
	onMove: (price: Price, date: IsoDate) => void;

	onDelete: (price: Price) => void;
	onClose: () => void;
}

/**
 * The price history panel.
 * @param props The panel's props.
 * @param props.security The security the history belongs to.
 * @param props.prices Its prices, newest first.
 * @param props.onWrite What recording a price does.
 * @param props.onMove What moving one to another day does.
 * @param props.onDelete What deleting one does.
 * @param props.onClose What closing the panel does.
 * @returns The panel.
 */
export const PriceHistoryPanel = ({ security, prices, onWrite, onMove, onDelete, onClose }: PriceHistoryPanelProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const [ isAdding, setIsAdding ] = useState(false);
	const [ priceToDelete, setPriceToDelete ] = useState<Price | undefined>(undefined);

	const addPrice = (values: PriceFormValues): void => {
		onWrite({ securityId: security.id, date: values.date, value: values.value, source: 'manual' });
		setIsAdding(false);
	};

	const columns: readonly DataTableColumn<Price>[] = [
		{
			key: 'date',
			header: t('prices.columns.date'),
			numeric: true,
			render: (price) => {
				return (
					<EditableCell<IsoDate | undefined>
						value={price.date}
						label={t('prices.edit.date', { date: formatter.storedDate(price.date) })}
						renderEditor={(value, onChange) => {
							return <DateField value={value} label={t('prices.columns.date')} required onChange={onChange}/>;
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onMove(price, value);

							return undefined;
						}}>
						{formatter.storedDate(price.date)}
					</EditableCell>
				);
			}
		},
		{
			key: 'value',
			header: t('prices.columns.value'),
			numeric: true,
			render: (price) => {
				return (
					<EditableCell<TenThousandths | undefined>
						value={price.value}
						label={t('prices.edit.value', { date: formatter.storedDate(price.date) })}
						renderEditor={(value, onChange) => {
							return (
								<PriceField
									value={value}
									label={t('prices.columns.value')}
									required
									minimum={SMALLEST_PRICE}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							if(value <= 0) {
								return t('prices.mustBePositive');
							}

							onWrite({ ...price, value, source: 'manual' });

							return undefined;
						}}>
						{formatter.unitPrice(price.value)}
					</EditableCell>
				);
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
						setIsAdding(true);
					}}>
					{t('prices.add')}
				</AppButton>
			</div>

			{prices.length === 0 ?
				<p className='investments-screen-note'>{t('prices.empty')}</p> :
				<DataTable
					columns={columns}
					rows={prices}
					label={t('prices.table')}
					footer={footer}
					getRowKey={(price) => {
						return price.date;
					}}/>}

			{isAdding && (
				<PriceForm
					security={security}
					onSave={addPrice}
					onCancel={() => {
						setIsAdding(false);
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
