import { useState, type ReactElement } from 'react';
import { DateField } from 'src/components/common/DateField';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { AmountField, PercentageField } from 'src/components/common/NumericFields';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TextField } from 'src/components/common/TextField';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { isAccountNameTaken, isCashAccountType, sortInstitutions } from 'src/logic/accounts/Accounts';
import { ACCOUNT_TYPES, type Account, type AccountType, type IsoDate, type LedgerId } from 'src/types/LedgerTypes';

/**
 * The account form, which is where most of the validation rules of the specification are enforced.
 *
 * **Two fields are decided by the type rather than by the user.** The institution is required on seven of the eight types and
 * disabled on `Cash`, which is money held by nobody; the exit tax appears on `Pension fund` alone, pre-filled at the Italian
 * rate, and goes away again with the type. **The cash/brokerage boundary is locked from the moment the account exists**, so an
 * account being corrected is offered only the side it is already on.
 *
 * Nothing here is written until *Save*: a form that cannot be saved states why beside the offending field and disables the button.
 */

// The Italian rate on a pension fund's payout before any reduction for years of participation, as the fraction the file stores
const DEFAULT_EXIT_TAX_RATE = 1500;

// What an account is created as, which is the type the empty state says is the usual place to start
const DEFAULT_ACCOUNT_TYPE: AccountType = 'current-account';

// The institution picker's entry for a type that cannot have one. It is a disabled state and never a value that is written.
const NO_INSTITUTION = 'none';

export interface AccountFormValues {
	name: string;
	institutionId: LedgerId | null;
	type: AccountType;
	openingBalance: number;
	exitTaxRate: number | null;
	openingDate: IsoDate;
	closingDate: IsoDate | null;
	notes: string;
}

export interface AccountFormProps {

	// The account being corrected, or undefined while one is being created
	account: Account | undefined;

	onSave: (values: AccountFormValues) => void;
	onCancel: () => void;
}

/**
 * The account form.
 * @param props The form's props.
 * @param props.account The account being corrected, where one is.
 * @param props.onSave What to do with the account the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const AccountForm = ({ account, onSave, onCancel }: AccountFormProps): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();
	const [ name, setName ] = useState(account?.name ?? '');
	const [ institutionId, setInstitutionId ] = useState<string>(account?.institutionId ?? '');
	const [ type, setType ] = useState<AccountType>(account?.type ?? DEFAULT_ACCOUNT_TYPE);
	const [ openingBalance, setOpeningBalance ] = useState<number | undefined>(account?.openingBalance ?? 0);
	const [ exitTaxRate, setExitTaxRate ] = useState<number | undefined>(account?.exitTaxRate ?? undefined);
	const [ openingDate, setOpeningDate ] = useState<IsoDate | undefined>(account?.openingDate);
	const [ closingDate, setClosingDate ] = useState<IsoDate | undefined>(account?.closingDate ?? undefined);
	const [ notes, setNotes ] = useState(account?.notes ?? '');

	// A required field states that it is required once it has been left empty, so a form nobody has touched yet is not covered in refusals
	const [ touched, setTouched ] = useState<readonly string[]>([]);

	const accounts = document?.accounts ?? [];
	const institutions = sortInstitutions(document?.institutions ?? []);
	const isCash = type === 'cash';
	const isBrokerage = type === 'brokerage';
	const isPensionFund = type === 'pension-fund';
	const trimmedName = name.trim();
	const chosenInstitutionId = isCash ? null : institutionId;

	const markTouched = (field: string): void => {
		setTouched((current) => {
			return current.includes(field) ? current : [ ...current, field ];
		});
	};

	// Switching the type is what moves the institution and the exit tax: one has its state changed, the other is added and removed outright
	const changeType = (next: AccountType): void => {
		setType(next);

		if(next === 'cash') {
			setInstitutionId('');
		}
		else if(isCash) {
			markTouched('institution');
		}

		if(next === 'brokerage') {
			setOpeningBalance(0);
		}

		setExitTaxRate(next === 'pension-fund' ? DEFAULT_EXIT_TAX_RATE : undefined);
	};

	const isNameTaken = trimmedName !== '' &&
		(isCash || institutionId !== '') &&
		isAccountNameTaken({ accounts, name: trimmedName, institutionId: chosenInstitutionId, exceptId: account?.id });

	const nameRefusal = (): string | undefined => {
		if(isNameTaken) {
			return isCash ? t('accounts.form.nameTakenWithoutInstitution') : t('accounts.form.nameTaken');
		}

		return touched.includes('name') && trimmedName === '' ? t('field.required') : undefined;
	};

	const isClosingBeforeOpening = closingDate !== undefined && openingDate !== undefined && closingDate < openingDate;

	const canSave = trimmedName !== '' &&
		!isNameTaken &&
		(isCash || institutionId !== '') &&
		openingBalance !== undefined &&
		(!isPensionFund || exitTaxRate !== undefined) &&
		openingDate !== undefined &&
		!isClosingBeforeOpening;

	// Only the side the account is already on: to move one across the boundary it is deleted and recorded again
	const offeredTypes = ACCOUNT_TYPES.filter((offered) => {
		return !account || isCashAccountType(offered) === isCashAccountType(account.type);
	});

	const typeOptions: readonly SelectOption<AccountType>[] = offeredTypes.map((offered) => {
		return { value: offered, label: t(`accounts.types.${offered}`) };
	});

	const institutionOptions: readonly SelectOption<string>[] = isCash ?
		[ { value: NO_INSTITUTION, label: t('accounts.form.institutionNone') } ] :
		[ { value: '', label: t('accounts.form.institutionChoose') }, ...institutions.map((institution) => {
			return { value: institution.id, label: institution.name };
		}) ];

	const save = (): void => {
		if(!canSave || openingBalance === undefined || openingDate === undefined) {
			return;
		}

		onSave({
			name: trimmedName,
			institutionId: isCash ? null : institutionId,
			type,
			openingBalance,
			exitTaxRate: isPensionFund ? exitTaxRate ?? null : null,
			openingDate,
			closingDate: closingDate ?? null,
			notes: notes.trim()
		});
	};

	return (
		<FormDialog
			title={account ? t('accounts.form.editTitle') : t('accounts.form.addTitle')}
			canSave={canSave}
			onSave={save}
			onCancel={onCancel}>
			<FormField label={t('accounts.form.name')}>
				<TextField
					value={name}
					label={t('accounts.form.name')}
					placeholder={t('accounts.form.namePlaceholder')}
					refusal={nameRefusal()}
					onChange={(value) => {
						markTouched('name');
						setName(value);
					}}/>
			</FormField>

			<FormField label={t('accounts.form.institution')} hint={isCash ? t('accounts.form.institutionOnlyCash') : undefined}>
				<SelectField
					value={isCash ? NO_INSTITUTION : institutionId}
					options={institutionOptions}
					label={t('accounts.form.institution')}
					disabled={isCash}
					refusal={!isCash && institutionId === '' && touched.includes('institution') ? t('field.required') : undefined}
					onChange={(value) => {
						markTouched('institution');
						setInstitutionId(value);
					}}/>
			</FormField>

			<FormField label={t('accounts.form.type')} hint={account ? t('accounts.form.typeLocked') : undefined}>
				<SelectField
					value={type}
					options={typeOptions}
					label={t('accounts.form.type')}
					onChange={changeType}/>
			</FormField>

			<FormField
				label={t('accounts.form.openingBalance')}
				hint={isBrokerage ? t('accounts.form.openingBalanceBrokerage') : undefined}>
				<AmountField
					value={openingBalance}
					label={t('accounts.form.openingBalance')}
					allowNegative
					required
					disabled={isBrokerage}
					onChange={setOpeningBalance}/>
			</FormField>

			{isPensionFund && (
				<FormField label={t('accounts.form.exitTax')} hint={t('accounts.form.exitTaxExplanation')}>
					<PercentageField
						value={exitTaxRate}
						label={t('accounts.form.exitTax')}
						required
						onChange={setExitTaxRate}/>
				</FormField>
			)}

			<FormField label={t('accounts.form.openingDate')}>
				<DateField
					value={openingDate}
					label={t('accounts.form.openingDate')}
					required
					onChange={setOpeningDate}/>
			</FormField>

			<FormField
				label={t('accounts.form.closingDate')}
				hint={t('accounts.form.closingDateHint')}
				refusal={isClosingBeforeOpening ? t('accounts.form.closingBeforeOpening') : undefined}>
				<DateField
					value={closingDate}
					label={t('accounts.form.closingDate')}
					minimum={DateUtils.fromStandardYearMonthDay(openingDate)}
					onChange={setClosingDate}/>
			</FormField>

			<FormField label={t('accounts.form.notes')}>
				<TextField
					value={notes}
					label={t('accounts.form.notes')}
					placeholder={t('form.optional')}
					onChange={setNotes}/>
			</FormField>
		</FormDialog>
	);
};
