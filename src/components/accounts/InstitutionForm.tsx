import { useState, type ReactElement } from 'react';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { AmountField } from 'src/components/common/NumericFields';
import { TextField } from 'src/components/common/TextField';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isInstitutionNameTaken } from 'src/logic/accounts/Accounts';
import type { Institution } from 'src/types/LedgerTypes';

/**
 * The institution form, which is the only way an institution is created: the account form picks from what is already recorded
 * and cannot create one.
 *
 * **The sell fee is required and empty is not zero.** It is the flat fee charged once per holding when estimating what a
 * position would leave you with, and an institution that never sells anything is given a zero rather than left blank.
 */

export interface InstitutionFormValues {
	name: string;
	defaultSellFee: number;
	notes: string;
}

export interface InstitutionFormProps {

	// The institution being corrected, or undefined while one is being created
	institution: Institution | undefined;

	onSave: (values: InstitutionFormValues) => void;
	onCancel: () => void;
}

/**
 * The institution form.
 * @param props The form's props.
 * @param props.institution The institution being corrected, where one is.
 * @param props.onSave What to do with the institution the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const InstitutionForm = ({ institution, onSave, onCancel }: InstitutionFormProps): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();
	const [ name, setName ] = useState(institution?.name ?? '');
	const [ defaultSellFee, setDefaultSellFee ] = useState<number | undefined>(institution?.defaultSellFee ?? 0);
	const [ notes, setNotes ] = useState(institution?.notes ?? '');
	const [ isNameTouched, setIsNameTouched ] = useState(false);

	const institutions = document?.institutions ?? [];
	const trimmedName = name.trim();
	const isNameTaken = trimmedName !== '' && isInstitutionNameTaken({ institutions, name: trimmedName, exceptId: institution?.id });
	const canSave = trimmedName !== '' && !isNameTaken && defaultSellFee !== undefined;

	const nameRefusal = (): string | undefined => {
		if(isNameTaken) {
			return t('institutions.form.nameTaken');
		}

		return isNameTouched && trimmedName === '' ? t('field.required') : undefined;
	};

	const save = (): void => {
		if(!canSave || defaultSellFee === undefined) {
			return;
		}

		onSave({ name: trimmedName, defaultSellFee, notes: notes.trim() });
	};

	return (
		<FormDialog
			title={institution ? t('institutions.form.editTitle') : t('institutions.form.addTitle')}
			canSave={canSave}
			onSave={save}
			onCancel={onCancel}>
			<FormField label={t('institutions.form.name')}>
				<TextField
					value={name}
					label={t('institutions.form.name')}
					placeholder={t('institutions.form.namePlaceholder')}
					refusal={nameRefusal()}
					onChange={(value) => {
						setIsNameTouched(true);
						setName(value);
					}}
					onBlur={() => {
						setIsNameTouched(true);
					}}/>
			</FormField>

			<FormField label={t('institutions.form.defaultSellFee')} hint={t('institutions.form.defaultSellFeeExplanation')}>
				<AmountField
					value={defaultSellFee}
					label={t('institutions.form.defaultSellFee')}
					minimum={0}
					required
					onChange={setDefaultSellFee}/>
			</FormField>

			<FormField label={t('institutions.form.notes')}>
				<TextField
					value={notes}
					label={t('institutions.form.notes')}
					placeholder={t('form.optional')}
					onChange={setNotes}/>
			</FormField>
		</FormDialog>
	);
};
