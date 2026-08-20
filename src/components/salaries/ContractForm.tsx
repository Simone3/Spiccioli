import { useState, type ReactElement } from 'react';
import { DateField } from 'src/components/common/DateField';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { IntegerField } from 'src/components/common/NumericFields';
import { DecimalField } from 'src/components/common/DecimalField';
import { TextField } from 'src/components/common/TextField';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { MONEY_SCALES } from 'src/logic/money/Money';
import {
	contractDateObstructions,
	isContractDateObstructionEmpty,
	isContractNameTaken,
	type ContractDateObstruction,
	type ContractDateObstructions
} from 'src/logic/salaries/Contracts';
import type { Contract, Hundredths, IsoDate } from 'src/types/LedgerTypes';

/**
 * The contract form, which is where the two terms every figure on the other tab divides by are set.
 *
 * **The dates are enforced against the records that already exist.** Widening is always fine and is what an employer extending
 * a contract looks like; narrowing is refused while a payslip or a ContractYear would be left outside the contract's life, and
 * the refusal names what is in the way rather than saying that something is. Delete the payslips or clear the years, and then
 * the dates move.
 *
 * **There is no history of contract terms.** Changing `monthsPerYear` or `hoursPerDay` re-computes every derived figure on the
 * Payslips tab, closed years included: the current values are applied to the whole contract.
 */

// What a contract is created with: the twelve months of the year, a contract carrying extra months of pay being the exception
const DEFAULT_MONTHS_PER_YEAR = 12;

const DEFAULT_HOURS_PER_DAY: Hundredths = 800;

// The bounds of the validation specification: a year of months, and a day of hours
const MONTHS_PER_YEAR_RANGE = { minimum: 1, maximum: 24 };

const HOURS_PER_DAY_MAXIMUM: Hundredths = 2400;

// The smallest hours-per-day the field admits, the specification asking for more than zero
const HOURS_PER_DAY_MINIMUM: Hundredths = 1;

// A month is written with both of its digits wherever it is named
const MONTH_DIGITS = 2;

export interface ContractFormValues {
	name: string;
	monthsPerYear: number;
	hoursPerDay: Hundredths;
	startDate: IsoDate;
	endDate: IsoDate | null;
	notes: string;
}

export interface ContractFormProps {

	// The contract being corrected, or undefined while one is being created
	contract: Contract | undefined;

	onSave: (values: ContractFormValues) => void;
	onCancel: () => void;
}

/**
 * The contract form.
 * @param props The form's props.
 * @param props.contract The contract being corrected, where one is.
 * @param props.onSave What to do with the contract the form holds.
 * @param props.onCancel What abandoning it does.
 * @returns The form.
 */
export const ContractForm = ({ contract, onSave, onCancel }: ContractFormProps): ReactElement => {
	const { t, formatList } = useTranslator();
	const { document } = useLedger();
	const [ name, setName ] = useState(contract?.name ?? '');
	const [ monthsPerYear, setMonthsPerYear ] = useState<number | undefined>(contract?.monthsPerYear ?? DEFAULT_MONTHS_PER_YEAR);
	const [ hoursPerDay, setHoursPerDay ] = useState<number | undefined>(contract?.hoursPerDay ?? DEFAULT_HOURS_PER_DAY);
	const [ startDate, setStartDate ] = useState<IsoDate | undefined>(contract?.startDate);
	const [ endDate, setEndDate ] = useState<IsoDate | undefined>(contract?.endDate ?? undefined);
	const [ notes, setNotes ] = useState(contract?.notes ?? '');

	// A required field states that it is required once it has been left empty, so a form nobody has touched yet is not covered in refusals
	const [ touched, setTouched ] = useState<readonly string[]>([]);

	const contracts = document?.contracts ?? [];
	const trimmedName = name.trim();
	const isNameTaken = trimmedName !== '' && isContractNameTaken({ contracts, name: trimmedName, exceptId: contract?.id });
	const isEndBeforeStart = endDate !== undefined && startDate !== undefined && endDate < startDate;

	const markTouched = (field: string): void => {
		setTouched((current) => {
			return current.includes(field) ? current : [ ...current, field ];
		});
	};

	// Only a contract that exists has records to be narrowed past: a new one has nothing pointing at it yet
	const obstructions = ((): ContractDateObstructions => {
		const nothing: ContractDateObstructions = {
			beforeStart: { payslips: [], years: [] },
			afterEnd: { payslips: [], years: [] }
		};

		if(!contract || startDate === undefined || isEndBeforeStart) {
			return nothing;
		}

		return contractDateObstructions({
			dates: { startDate, endDate: endDate ?? null },
			payslips: (document?.payslips ?? []).filter((payslip) => {
				return payslip.contractId === contract.id;
			}),
			contractYears: (document?.contractYears ?? []).filter((contractYear) => {
				return contractYear.contractId === contract.id;
			})
		});
	})();

	// The refusal is stated beside the date that causes it, and names what is in the way rather than saying that something is
	const obstructionRefusal = (obstruction: ContractDateObstruction): string | undefined => {
		if(obstruction.payslips.length > 0) {
			return t('contracts.form.narrowedPastPayslips', {
				count: obstruction.payslips.length,
				months: formatList(obstruction.payslips.map((payslip) => {
					return t('payslips.monthOfYear', { month: String(payslip.month).padStart(MONTH_DIGITS, '0'), year: String(payslip.year) });
				}))
			});
		}

		if(obstruction.years.length > 0) {
			return t('contracts.form.narrowedPastYears', {
				count: obstruction.years.length,
				years: formatList(obstruction.years.map((year) => {
					return String(year);
				}))
			});
		}

		return undefined;
	};

	const canSave = trimmedName !== '' &&
		!isNameTaken &&
		monthsPerYear !== undefined &&
		hoursPerDay !== undefined &&
		hoursPerDay > 0 &&
		startDate !== undefined &&
		!isEndBeforeStart &&
		isContractDateObstructionEmpty(obstructions.beforeStart) &&
		isContractDateObstructionEmpty(obstructions.afterEnd);

	const nameRefusal = (): string | undefined => {
		if(isNameTaken) {
			return t('contracts.form.nameTaken');
		}

		return touched.includes('name') && trimmedName === '' ? t('field.required') : undefined;
	};

	const save = (): void => {
		if(!canSave || monthsPerYear === undefined || hoursPerDay === undefined || startDate === undefined) {
			return;
		}

		onSave({
			name: trimmedName,
			monthsPerYear,
			hoursPerDay,
			startDate,
			endDate: endDate ?? null,
			notes: notes.trim()
		});
	};

	return (
		<FormDialog
			title={contract ? t('contracts.form.editTitle') : t('contracts.form.addTitle')}
			canSave={canSave}
			onSave={save}
			onCancel={onCancel}>
			<FormField label={t('contracts.form.name')}>
				<TextField
					value={name}
					label={t('contracts.form.name')}
					placeholder={t('contracts.form.namePlaceholder')}
					refusal={nameRefusal()}
					onChange={(value) => {
						markTouched('name');
						setName(value);
					}}/>
			</FormField>

			<FormField label={t('contracts.form.monthsPerYear')} hint={t('contracts.form.monthsPerYearHint')}>
				<IntegerField
					value={monthsPerYear}
					label={t('contracts.form.monthsPerYear')}
					minimum={MONTHS_PER_YEAR_RANGE.minimum}
					maximum={MONTHS_PER_YEAR_RANGE.maximum}
					required
					onChange={setMonthsPerYear}/>
			</FormField>

			<FormField label={t('contracts.form.hoursPerDay')}>
				<DecimalField
					value={hoursPerDay}
					scale={MONEY_SCALES.hundredths}
					label={t('contracts.form.hoursPerDay')}
					minimum={HOURS_PER_DAY_MINIMUM}
					maximum={HOURS_PER_DAY_MAXIMUM}
					required
					onChange={setHoursPerDay}/>
			</FormField>

			<FormField label={t('contracts.form.startDate')} refusal={obstructionRefusal(obstructions.beforeStart)}>
				<DateField
					value={startDate}
					label={t('contracts.form.startDate')}
					required
					onChange={setStartDate}/>
			</FormField>

			<FormField
				label={t('contracts.form.endDate')}
				hint={t('contracts.form.endDateHint')}
				refusal={isEndBeforeStart ? t('contracts.form.endBeforeStart') : obstructionRefusal(obstructions.afterEnd)}>
				<DateField
					value={endDate}
					label={t('contracts.form.endDate')}
					minimum={DateUtils.fromStandardYearMonthDay(startDate)}
					onChange={setEndDate}/>
			</FormField>

			<FormField label={t('contracts.form.notes')}>
				<TextField
					value={notes}
					label={t('contracts.form.notes')}
					placeholder={t('form.optional')}
					onChange={setNotes}/>
			</FormField>
		</FormDialog>
	);
};
