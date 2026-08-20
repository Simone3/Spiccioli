import { useState, type ReactElement } from 'react';
import { DateField } from 'src/components/common/DateField';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { PriceField } from 'src/components/common/NumericFields';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { priceOnDay } from 'src/logic/investments/Securities';
import type { IsoDate, Price, Security, TenThousandths } from 'src/types/LedgerTypes';

/**
 * The form a price is recorded and corrected in, from the Securities tab.
 *
 * **One price per security per day.** The form says what the chosen day already holds rather than refusing it: recording a price
 * for a day that has one replaces that day and leaves the rest of the history alone, which is the whole of the rule. The record
 * being corrected is not what it warns about — a day holding only itself is not a day being replaced.
 *
 * **Saving here makes the record `manual`**, an edit to the value and an edit to the date alike, so a fetched figure somebody
 * has corrected stops claiming to be the provider's.
 */

// The lowest price this field admits, in the ten-thousandths a price is stored in. A price is more than zero wherever one is typed.
const SMALLEST_PRICE = 1;

export interface PriceFormValues {
	date: IsoDate;
	value: TenThousandths;
}

export interface PriceFormProps {
	security: Security;

	// The record being corrected, or undefined while one is being recorded
	price: Price | undefined;

	onSave: (values: PriceFormValues) => void;
	onCancel: () => void;
}

/**
 * The price form.
 * @param props The form's props.
 * @param props.security The security the price belongs to.
 * @param props.price The record being corrected, where one is.
 * @param props.onSave What to do with the price the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const PriceForm = ({ security, price, onSave, onCancel }: PriceFormProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const { document } = useLedger();
	const [ date, setDate ] = useState<IsoDate | undefined>(() => {
		return price?.date ?? DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());
	});
	const [ value, setValue ] = useState<TenThousandths | undefined>(price?.value);

	const occupying = date === undefined ? undefined : priceOnDay(document?.prices ?? [], security.id, date);

	// The day the record already sits on holds the record itself, which is not a value this save would displace
	const standing = occupying && occupying.date === price?.date ? undefined : occupying;
	const canSave = date !== undefined && value !== undefined && value > 0;

	return (
		<FormDialog
			title={price ? t('prices.form.editTitle') : t('prices.form.addTitle')}
			subtitle={t('prices.form.subtitle', { ticker: security.ticker })}
			canSave={canSave}
			onCancel={onCancel}
			onSave={() => {
				if(date !== undefined && value !== undefined) {
					onSave({ date, value });
				}
			}}>
			<FormField
				label={t('prices.form.date')}
				hint={standing ? t('prices.form.replaces', { value: formatter.unitPrice(standing.value) }) : undefined}>
				<DateField value={date} label={t('prices.form.date')} required onChange={setDate}/>
			</FormField>

			<FormField label={t('prices.form.value')}>
				<PriceField value={value} label={t('prices.form.value')} required minimum={SMALLEST_PRICE} onChange={setValue}/>
			</FormField>
		</FormDialog>
	);
};
