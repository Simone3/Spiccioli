import { useState, type ReactElement } from 'react';
import { FormDialog } from 'src/components/common/FormDialog';
import {
	emptySecurityValues,
	isSecurityComplete,
	SecurityFields,
	securityValuesOf,
	type SecurityFormValues
} from 'src/components/investments/SecurityFields';
import { useLedger } from 'src/contexts/LedgerContext';
import { usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isIsinTaken } from 'src/logic/investments/Securities';
import type { Security } from 'src/types/LedgerTypes';

/**
 * The form a security is created and corrected in.
 *
 * **Correcting a security changes nothing that was ever recorded**: the trades and the whole price history belong to it and stay
 * with it. That is what makes this the tab a mistyped ISIN, a renamed instrument, a wrong exchange or a blended bond rate is put
 * right on, rather than something to be avoided once trades exist.
 */

export interface SecurityFormProps {

	// The security being corrected, or undefined while one is being created
	security: Security | undefined;

	onSave: (values: SecurityFormValues) => void;
	onCancel: () => void;
}

/**
 * The security form.
 * @param props The form's props.
 * @param props.security The security being corrected, where one is.
 * @param props.onSave What to do with the security the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const SecurityForm = ({ security, onSave, onCancel }: SecurityFormProps): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();
	const { preferences } = usePreferences();
	const [ values, setValues ] = useState<SecurityFormValues>(() => {
		return security ? securityValuesOf(security) : emptySecurityValues(preferences.defaultTaxRate);
	});

	const securities = document?.securities ?? [];
	const isTaken = values.isin.trim() !== '' && isIsinTaken({ securities, isin: values.isin, exceptId: security?.id });
	const canSave = isSecurityComplete(values) && !isTaken;

	return (
		<FormDialog
			title={security ? t('securities.form.editTitle') : t('securities.form.addTitle')}
			canSave={canSave}
			onCancel={onCancel}
			onSave={() => {
				if(canSave) {
					onSave(values);
				}
			}}>
			<SecurityFields
				withNotes
				values={values}
				isinRefusal={isTaken ? t('securities.form.isinTaken') : undefined}
				onChange={setValues}/>
		</FormDialog>
	);
};
