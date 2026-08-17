import { useState, type ReactElement } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { AUTOMATIC_CATEGORY, CategoryPicker } from 'src/components/categories/CategoryPicker';
import { DateField } from 'src/components/common/DateField';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { AmountField } from 'src/components/common/NumericFields';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TextField } from 'src/components/common/TextField';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { useTranslator } from 'src/i18n/TranslationContext';
import { RECEIPT_STATES, type Cents, type IsoDate, type LedgerId, type ReceiptState, type Transaction } from 'src/types/LedgerTypes';

/**
 * The add-transaction form: the seven fields the user fills in, and no others.
 *
 * The three stored fields it does not ask for follow from what it does. `categorySource` is the category picker — *Automatic*
 * means the rules own the row and any category means the user does — and `id` and `insertionSeq` are the application's.
 *
 * **This is the one place a row can be given a receipt state before it exists.** Every other way a row arrives — an import, a
 * duplicate — creates it *N/A* and leaves the state to be moved afterwards.
 *
 * **Save and add another** keeps the panel open with the account and the date retained, which are the two fields a run of rows
 * from one statement shares, and clears the rest.
 */

export interface TransactionFormValues {
	accountId: LedgerId;
	date: IsoDate;
	description: string;
	amount: Cents;

	// Null where the picker is on *Automatic*: what the rules produce is worked out as the row is written
	categoryId: LedgerId | null;
	categorySource: Transaction['categorySource'];
	receiptState: ReceiptState;
	notes: string;
}

export interface TransactionFormProps {

	// Called with the row to write, and with whether the panel stays open for the next one
	onSave: (values: TransactionFormValues, addAnother: boolean) => void;

	onCancel: () => void;
}

/**
 * The add-transaction form.
 * @param props The form's props.
 * @param props.onSave What to do with the transaction the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const TransactionForm = ({ onSave, onCancel }: TransactionFormProps): ReactElement => {
	const { t } = useTranslator();
	const [ accountId, setAccountId ] = useState<LedgerId | undefined>(undefined);
	const [ date, setDate ] = useState<IsoDate | undefined>(DateUtils.toStandardYearMonthDay(new Date()));
	const [ description, setDescription ] = useState('');
	const [ amount, setAmount ] = useState<Cents | undefined>(undefined);
	const [ category, setCategory ] = useState<string>(AUTOMATIC_CATEGORY);
	const [ receiptState, setReceiptState ] = useState<ReceiptState>('na');
	const [ notes, setNotes ] = useState('');

	// A required field states that it is required once it has been left empty, so a form nobody has touched yet is not covered in refusals
	const [ isDescriptionTouched, setIsDescriptionTouched ] = useState(false);

	const trimmedDescription = description.trim();
	const canSave = accountId !== undefined && date !== undefined && trimmedDescription !== '' && amount !== undefined;

	const receiptOptions: readonly SelectOption<ReceiptState>[] = RECEIPT_STATES.map((state) => {
		return { value: state, label: t(`receiptStates.${state}`) };
	});

	// The account and the date are what a run of rows off one statement shares, so they are what stays
	const clearForTheNextRow = (): void => {
		setDescription('');
		setAmount(undefined);
		setCategory(AUTOMATIC_CATEGORY);
		setReceiptState('na');
		setNotes('');
		setIsDescriptionTouched(false);
	};

	const save = (addAnother: boolean): void => {
		if(accountId === undefined || date === undefined || amount === undefined || trimmedDescription === '') {
			return;
		}

		onSave({
			accountId,
			date,
			description: trimmedDescription,
			amount,
			categoryId: category === AUTOMATIC_CATEGORY ? null : category,
			categorySource: category === AUTOMATIC_CATEGORY ? 'automatic' : 'manual',
			receiptState,
			notes: notes.trim()
		}, addAnother);

		if(addAnother) {
			clearForTheNextRow();
		}
	};

	return (
		<FormDialog
			title={t('transactions.form.addTitle')}
			canSave={canSave}
			secondaryAction={{
				label: t('transactions.form.saveAndAddAnother'),
				onSelect: () => {
					save(true);
				}
			}}
			onSave={() => {
				save(false);
			}}
			onCancel={onCancel}>
			<FormField label={t('transactions.form.account')}>
				<AccountPicker
					value={accountId}
					side='cash'
					label={t('transactions.form.account')}
					placeholder={t('transactions.form.accountChoose')}
					onChange={setAccountId}/>
			</FormField>

			<FormField label={t('transactions.form.date')}>
				<DateField
					value={date}
					label={t('transactions.form.date')}
					required
					onChange={setDate}/>
			</FormField>

			<FormField label={t('transactions.form.description')}>
				<TextField
					value={description}
					label={t('transactions.form.description')}
					placeholder={t('transactions.form.descriptionPlaceholder')}
					refusal={isDescriptionTouched && trimmedDescription === '' ? t('field.required') : undefined}
					onChange={(value) => {
						setIsDescriptionTouched(true);
						setDescription(value);
					}}/>
			</FormField>

			<FormField label={t('transactions.form.amount')} hint={t('transactions.form.amountHint')}>
				<AmountField
					value={amount}
					label={t('transactions.form.amount')}
					allowNegative
					required
					onChange={setAmount}/>
			</FormField>

			<FormField label={t('transactions.form.category')}>
				<CategoryPicker
					value={category}
					mode='assign'
					label={t('transactions.form.category')}
					onChange={setCategory}/>
			</FormField>

			<FormField label={t('transactions.form.receipt')}>
				<SelectField
					value={receiptState}
					options={receiptOptions}
					label={t('transactions.form.receipt')}
					onChange={setReceiptState}/>
			</FormField>

			<FormField label={t('transactions.form.notes')}>
				<TextField
					value={notes}
					label={t('transactions.form.notes')}
					placeholder={t('form.optional')}
					onChange={setNotes}/>
			</FormField>
		</FormDialog>
	);
};
