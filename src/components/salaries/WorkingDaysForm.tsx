import { useState, type ReactElement } from 'react';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { IntegerField } from 'src/components/common/NumericFields';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The one field a ContractYear holds, and the form that is the whole of the record.
 *
 * **This form does not report a record — it *is* one.** Saving a number creates the ContractYear, and **saving it empty deletes
 * it**, putting the year back exactly where it was before anything was entered. That delete is the one in the application that
 * is not confirmed, the form being the whole of it.
 *
 * **A year without one reads *undefined* in the two hourly columns** rather than zero: the rate cannot be computed, which is not
 * the same as being nothing.
 */

// The bounds of the validation specification: a day of the year, and a leap year's worth of them
const WORKING_DAYS_RANGE = { minimum: 1, maximum: 366 };

export interface WorkingDaysFormProps {
	year: number;

	// What the year currently holds, or undefined where nothing has been entered for it
	workingDays: number | undefined;

	// Called with the number to record, or with undefined where the field was left empty and the record goes
	onSave: (workingDays: number | undefined) => void;

	onCancel: () => void;
}

/**
 * The working-days form.
 * @param props The form's props.
 * @param props.year The year the record belongs to.
 * @param props.workingDays What that year currently holds.
 * @param props.onSave What to do with the number the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const WorkingDaysForm = ({ year, workingDays, onSave, onCancel }: WorkingDaysFormProps): ReactElement => {
	const { t } = useTranslator();
	const [ days, setDays ] = useState<number | undefined>(workingDays);

	return (
		<FormDialog
			title={t('payslips.workingDaysTitle')}
			subtitle={t('payslips.workingDaysSubtitle', { year: String(year) })}
			canSave
			onCancel={onCancel}
			onSave={() => {
				onSave(days);
			}}>
			<FormField label={t('payslips.yearColumns.workingDays')} hint={t('payslips.workingDaysClears')}>
				<IntegerField
					value={days}
					label={t('payslips.yearColumns.workingDays')}
					minimum={WORKING_DAYS_RANGE.minimum}
					maximum={WORKING_DAYS_RANGE.maximum}
					onChange={setDays}/>
			</FormField>
		</FormDialog>
	);
};
