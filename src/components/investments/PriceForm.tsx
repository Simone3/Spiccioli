import { useState, type ReactElement } from 'react';
import { DateField } from 'src/components/common/DateField';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { PriceField } from 'src/components/common/NumericFields';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { priceOnDay } from 'src/logic/investments/Securities';
import type { IsoDate, Security, TenThousandths } from 'src/types/LedgerTypes';

/**
 * The form a price is recorded in, from the Securities tab.
 *
 * **One price per security per day.** The form says what the chosen day already holds rather than refusing it: recording a price
 * for a day that has one replaces that day and leaves the rest of the history alone, which is the whole of the rule.
 */

// The lowest price this field admits, in the ten-thousandths a price is stored in. A price is more than zero wherever one is typed.
const SMALLEST_PRICE = 1;

export interface PriceFormValues {
	date: IsoDate;
	value: TenThousandths;
}

export interface PriceFormProps {
	security: Security;
	onSave: (values: PriceFormValues) => void;
	onCancel: () => void;
}

/**
 * The price form.
 * @param props The form's props.
 * @param props.security The security the price belongs to.
 * @param props.onSave What to do with the price the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const PriceForm = ({ security, onSave, onCancel }: PriceFormProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const { document } = useLedger();
	const [ date, setDate ] = useState<IsoDate | undefined>(() => {
		return DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());
	});
	const [ value, setValue ] = useState<TenThousandths | undefined>(undefined);

	const standing = date === undefined ? undefined : priceOnDay(document?.prices ?? [], security.id, date);
	const canSave = date !== undefined && value !== undefined && value > 0;

	return (
		<FormDialog
			title={t('prices.form.addTitle')}
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
