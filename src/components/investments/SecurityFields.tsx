import type { ReactElement } from 'react';
import { FormField } from 'src/components/common/FormDialog';
import { PercentageField } from 'src/components/common/NumericFields';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TextField } from 'src/components/common/TextField';
import { useTranslator } from 'src/i18n/TranslationContext';
import { EXCHANGES, SECURITY_TYPES, type Exchange, type LedgerId, type Security, type SecurityType } from 'src/types/LedgerTypes';

/**
 * The fields a security is made of, in the one place both forms that carry them read from.
 *
 * **A security is created by two paths and the record is the same either way** — *Add security* on the Securities tab, and the
 * purchase form expanding while the first trade that needs it is recorded — so the fields live here rather than in either.
 *
 * **`exchange` is one of them and is required**, a security being one listing and it taking two fields to say which: the ISIN
 * says which instrument, the exchange says where it is quoted. Getting it wrong costs nothing that is recorded — only a quote
 * that does not arrive.
 */

// What a security is created as, which is what most of a portfolio holds
const DEFAULT_SECURITY_TYPE: SecurityType = 'stock-etf';

// Where most of what this application was written around is listed
const DEFAULT_EXCHANGE: Exchange = 'milan';

export interface SecurityFormValues {
	isin: string;
	ticker: string;
	exchange: Exchange;
	name: string;
	type: SecurityType;

	// The rate as it is stored: a fraction in ten-thousandths, and undefined while the field is empty
	taxRate: number | undefined;

	notes: string;
}

export interface SecurityFieldsProps {
	values: SecurityFormValues;
	onChange: (values: SecurityFormValues) => void;

	// Why the ISIN cannot be taken, where it cannot
	isinRefusal?: string;

	// Whether the notes field is offered. The form expanded inside a trade does not carry it.
	withNotes?: boolean;
}

/**
 * What the fields hold before anything is typed into them.
 * @param defaultTaxRate The rate a security is created at, from the preferences.
 * @returns Empty values.
 */
export const emptySecurityValues = (defaultTaxRate: number): SecurityFormValues => {
	return {
		isin: '',
		ticker: '',
		exchange: DEFAULT_EXCHANGE,
		name: '',
		type: DEFAULT_SECURITY_TYPE,
		taxRate: defaultTaxRate,
		notes: ''
	};
};

/**
 * What the fields hold when an existing security is being corrected.
 * @param security The security.
 * @returns Its values.
 */
export const securityValuesOf = (security: Security): SecurityFormValues => {
	return {
		isin: security.isin,
		ticker: security.ticker,
		exchange: security.exchange,
		name: security.name,
		type: security.type,
		taxRate: security.taxRate,
		notes: security.notes
	};
};

/**
 * Says whether the fields hold a security that can be written.
 * @param values The values.
 * @returns Whether every required field has something in it.
 */
export const isSecurityComplete = (values: SecurityFormValues): boolean => {
	return values.isin.trim() !== '' && values.ticker.trim() !== '' && values.name.trim() !== '' && values.taxRate !== undefined;
};

/**
 * Turns the fields into the record that is written.
 * @param values The values.
 * @param id The identity the security takes.
 * @returns The security.
 */
export const toSecurity = (values: SecurityFormValues, id: LedgerId): Security => {
	return {
		id,
		isin: values.isin.trim(),
		ticker: values.ticker.trim(),
		exchange: values.exchange,
		name: values.name.trim(),
		type: values.type,
		taxRate: values.taxRate ?? 0,
		notes: values.notes.trim()
	};
};

/**
 * The fields themselves.
 * @param props The fields' props.
 * @param props.values What they hold.
 * @param props.onChange What changing one does.
 * @param props.isinRefusal Why the ISIN cannot be taken, where it cannot.
 * @param props.withNotes Whether the notes field is offered.
 * @returns The rows.
 */
export const SecurityFields = ({ values, onChange, isinRefusal, withNotes = false }: SecurityFieldsProps): ReactElement => {
	const { t } = useTranslator();

	const typeOptions: readonly SelectOption<SecurityType>[] = SECURITY_TYPES.map((type) => {
		return { value: type, label: t(`securityTypes.${type}`) };
	});

	const exchangeOptions: readonly SelectOption<Exchange>[] = EXCHANGES.map((exchange) => {
		return { value: exchange, label: t(`exchanges.${exchange}`) };
	});

	const change = (changes: Partial<SecurityFormValues>): void => {
		onChange({ ...values, ...changes });
	};

	return (
		<>
			<FormField label={t('securities.form.isin')}>
				<TextField
					value={values.isin}
					label={t('securities.form.isin')}
					placeholder={t('securities.form.isinPlaceholder')}
					refusal={isinRefusal}
					onChange={(isin) => {
						change({ isin });
					}}/>
			</FormField>

			<FormField label={t('securities.form.ticker')} hint={t('securities.form.tickerHint')}>
				<TextField
					value={values.ticker}
					label={t('securities.form.ticker')}
					placeholder={t('securities.form.tickerPlaceholder')}
					onChange={(ticker) => {
						change({ ticker });
					}}/>
			</FormField>

			<FormField label={t('securities.form.exchange')} hint={t('securities.form.exchangeHint')}>
				<SelectField
					value={values.exchange}
					options={exchangeOptions}
					label={t('securities.form.exchange')}
					onChange={(exchange) => {
						change({ exchange });
					}}/>
			</FormField>

			<FormField label={t('securities.form.name')}>
				<TextField
					value={values.name}
					label={t('securities.form.name')}
					placeholder={t('securities.form.namePlaceholder')}
					onChange={(name) => {
						change({ name });
					}}/>
			</FormField>

			<FormField label={t('securities.form.type')}>
				<SelectField
					value={values.type}
					options={typeOptions}
					label={t('securities.form.type')}
					onChange={(type) => {
						change({ type });
					}}/>
			</FormField>

			<FormField label={t('securities.form.taxRate')} hint={t('securities.form.taxRateHint')}>
				<PercentageField
					value={values.taxRate}
					label={t('securities.form.taxRate')}
					required
					onChange={(taxRate) => {
						change({ taxRate });
					}}/>
			</FormField>

			{withNotes && (
				<FormField label={t('securities.form.notes')}>
					<TextField
						value={values.notes}
						label={t('securities.form.notes')}
						placeholder={t('form.optional')}
						onChange={(notes) => {
							change({ notes });
						}}/>
				</FormField>
			)}
		</>
	);
};
