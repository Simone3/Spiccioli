import { useState, type ReactElement } from 'react';
import { FormDialog, FormField, FormSection } from 'src/components/common/FormDialog';
import { AmountField, IntegerField } from 'src/components/common/NumericFields';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TextField } from 'src/components/common/TextField';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { isMonthInContract } from 'src/logic/salaries/Contracts';
import type { Cents, Contract, Payslip } from 'src/types/LedgerTypes';

/**
 * The payslip form: all twelve stored fields, with the year at the top and the eleven the table shows below it.
 *
 * **Year is the one field that arrives filled in**, and it is a picker holding exactly the years the per-year table has rows
 * for — the contract's own years — so no year the contract never covered can be chosen. It opens on the year the table below is
 * already showing, and changing it is how a payslip is filed into another year without leaving the form.
 *
 * **Every other field is empty**: no month is proposed, no figure is carried over from the previous payslip, and no amount is
 * filled in on the user's behalf. *Duplicate* is what exists for a row that resembles another.
 *
 * **The three pension figures are named by the heading over them** rather than by their own labels: *employee*, *employer* and
 * *TFR* say which credit, and *Pension fund* says what they are credits into. **They are the last three fields on the form**,
 * so the heading has nothing under it that it does not name, and the derived net salary sits where the table inserts it —
 * immediately after the three entered figures it is made of.
 *
 * **The month has to fall inside the contract's life**, which is what a partial first or last year is caught by, and the
 * refusal says so beside the month rather than in a modal.
 */

// The bounds of the validation specification: the twelve months of the year
const MONTH_RANGE = { minimum: 1, maximum: 12 };

// A month is written with both of its digits wherever it is named
const MONTH_DIGITS = 2;

// The smallest gross the specification admits, in the cents an amount is stored in: both gross figures are more than zero
const SMALLEST_GROSS: Cents = 1;

export interface PayslipFormValues {
	year: number;
	month: number;
	label: string | null;
	contractGross: Cents;
	gross: Cents;
	netPayment: Cents;
	refunds: Cents;
	carPayment: Cents;
	employeeContribution: Cents;
	employerContribution: Cents;
	severanceContribution: Cents;
	notes: string;
}

export interface PayslipFormProps {

	// The contract the screen is scoped to, whose dates the month has to fall inside
	contract: Contract;

	// The years the picker offers, which are the rows of the per-year table
	years: readonly number[];

	// The year the picker opens on, which is the one the table below is showing
	initialYear: number;

	// The payslip being corrected, or undefined while one is being created
	payslip: Payslip | undefined;

	onSave: (values: PayslipFormValues) => void;
	onCancel: () => void;
}

/**
 * The payslip form.
 * @param props The form's props.
 * @param props.contract The contract the payslip belongs to.
 * @param props.years The years the picker offers.
 * @param props.initialYear The year it opens on.
 * @param props.payslip The payslip being corrected, where there is one.
 * @param props.onSave What to do with the payslip the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const PayslipForm = ({ contract, years, initialYear, payslip, onSave, onCancel }: PayslipFormProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const [ year, setYear ] = useState(payslip?.year ?? initialYear);
	const [ month, setMonth ] = useState<number | undefined>(payslip?.month);
	const [ label, setLabel ] = useState(payslip?.label ?? '');
	const [ contractGross, setContractGross ] = useState<number | undefined>(payslip?.contractGross);
	const [ gross, setGross ] = useState<number | undefined>(payslip?.gross);
	const [ netPayment, setNetPayment ] = useState<number | undefined>(payslip?.netPayment);
	const [ refunds, setRefunds ] = useState<number | undefined>(payslip?.refunds);
	const [ carPayment, setCarPayment ] = useState<number | undefined>(payslip?.carPayment);
	const [ employeeContribution, setEmployeeContribution ] = useState<number | undefined>(payslip?.employeeContribution);
	const [ employerContribution, setEmployerContribution ] = useState<number | undefined>(payslip?.employerContribution);
	const [ severanceContribution, setSeveranceContribution ] = useState<number | undefined>(payslip?.severanceContribution);
	const [ notes, setNotes ] = useState(payslip?.notes ?? '');

	const isMonthOutside = month !== undefined && !isMonthInContract(contract, year, month);

	const yearOptions: readonly SelectOption<string>[] = years.map((offered) => {
		return { value: String(offered), label: String(offered) };
	});

	const canSave = month !== undefined &&
		!isMonthOutside &&
		contractGross !== undefined &&
		gross !== undefined &&
		netPayment !== undefined &&
		refunds !== undefined &&
		carPayment !== undefined &&
		employeeContribution !== undefined &&
		employerContribution !== undefined &&
		severanceContribution !== undefined;

	// The only figure the form derives, and the only one that is never a field
	const derivedNetSalary = netPayment === undefined || refunds === undefined || carPayment === undefined ?
		undefined :
		netPayment - refunds + carPayment;

	const save = (): void => {
		if(!canSave ||
			month === undefined ||
			contractGross === undefined ||
			gross === undefined ||
			netPayment === undefined ||
			refunds === undefined ||
			carPayment === undefined ||
			employeeContribution === undefined ||
			employerContribution === undefined ||
			severanceContribution === undefined) {
			return;
		}

		const trimmedLabel = label.trim();

		onSave({
			year,
			month,
			label: trimmedLabel === '' ? null : trimmedLabel,
			contractGross,
			gross,
			netPayment,
			refunds,
			carPayment,
			employeeContribution,
			employerContribution,
			severanceContribution,
			notes: notes.trim()
		});
	};

	// A magnitude the formulas apply the sign of: it is entered positive and never with a sign
	const magnitudeField = (fieldLabel: string, value: number | undefined, onChange: (next: number | undefined) => void): ReactElement => {
		return (
			<AmountField
				value={value}
				label={fieldLabel}
				minimum={0}
				required
				onChange={onChange}/>
		);
	};

	return (
		<FormDialog
			title={payslip ? t('payslips.form.editTitle') : t('payslips.form.addTitle')}
			subtitle={contract.name}
			canSave={canSave}
			onSave={save}
			onCancel={onCancel}>
			<FormField label={t('payslips.form.year')}>
				<SelectField
					value={String(year)}
					options={yearOptions}
					label={t('payslips.form.year')}
					onChange={(value) => {
						setYear(Number(value));
					}}/>
			</FormField>

			<FormField
				label={t('payslips.form.month')}
				refusal={isMonthOutside && month !== undefined ?
					t('payslips.form.monthOutsideContract', {
						month: t('payslips.monthOfYear', { month: String(month).padStart(MONTH_DIGITS, '0'), year: String(year) })
					}) :
					undefined}>
				<IntegerField
					value={month}
					label={t('payslips.form.month')}
					minimum={MONTH_RANGE.minimum}
					maximum={MONTH_RANGE.maximum}
					required
					onChange={setMonth}/>
			</FormField>

			<FormField label={t('payslips.form.label')}>
				<TextField
					value={label}
					label={t('payslips.form.label')}
					placeholder={t('payslips.form.labelPlaceholder')}
					onChange={setLabel}/>
			</FormField>

			<FormField label={t('payslips.form.contractGross')}>
				<AmountField
					value={contractGross}
					label={t('payslips.form.contractGross')}
					minimum={SMALLEST_GROSS}
					required
					onChange={setContractGross}/>
			</FormField>

			<FormField label={t('payslips.form.gross')} hint={t('payslips.form.grossHint')}>
				<AmountField
					value={gross}
					label={t('payslips.form.gross')}
					minimum={SMALLEST_GROSS}
					required
					onChange={setGross}/>
			</FormField>

			<FormField label={t('payslips.form.netPayment')} hint={t('payslips.form.netPaymentHint')}>
				<AmountField
					value={netPayment}
					label={t('payslips.form.netPayment')}
					allowNegative
					required
					onChange={setNetPayment}/>
			</FormField>

			<FormField label={t('payslips.form.refunds')}>
				{magnitudeField(t('payslips.form.refunds'), refunds, setRefunds)}
			</FormField>

			<FormField label={t('payslips.form.carPayment')}>
				{magnitudeField(t('payslips.form.carPayment'), carPayment, setCarPayment)}
			</FormField>

			<FormField label={t('payslips.form.netSalary')} hint={t('payslips.form.netSalaryHint')}>
				<p className='salaries-screen-derived'>
					{derivedNetSalary === undefined ? t('table.notApplicable') : formatter.amount(derivedNetSalary)}
				</p>
			</FormField>

			<FormField label={t('payslips.form.notes')}>
				<TextField
					value={notes}
					label={t('payslips.form.notes')}
					placeholder={t('form.optional')}
					onChange={setNotes}/>
			</FormField>

			<FormSection label={t('payslips.form.pensionSection')}/>

			<FormField label={t('payslips.form.employeeContribution')}>
				{magnitudeField(t('payslips.form.employeeContribution'), employeeContribution, setEmployeeContribution)}
			</FormField>

			<FormField label={t('payslips.form.employerContribution')}>
				{magnitudeField(t('payslips.form.employerContribution'), employerContribution, setEmployerContribution)}
			</FormField>

			<FormField label={t('payslips.form.severanceContribution')}>
				{magnitudeField(t('payslips.form.severanceContribution'), severanceContribution, setSeveranceContribution)}
			</FormField>
		</FormDialog>
	);
};
