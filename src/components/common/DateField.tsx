import 'react-datepicker/dist/react-datepicker.css';
import 'src/components/common/DateField.css';
import ReactDatePicker from 'react-datepicker';
import { useId, useState, type ChangeEvent, type ReactElement, type Ref } from 'react';
import { usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import type { DateFormat } from 'src/types/PreferencesTypes';
import type { IsoDate } from 'src/types/LedgerTypes';

/**
 * The one date control, and the only place "react-datepicker" is imported.
 *
 * The library draws the calendar and nothing else: **the typing and the refusal are ours**, through a custom input that admits
 * digits and the separator of the format in force and nothing else, and its stylesheet is overridden to the theme and to the one
 * focus ring. Every screen sees this control and never the library, so replacing it is this file.
 *
 * **The format is the preference's**, never a system locale's, and **no day after today is offerable** — every date in the
 * application is a fact about a day that has happened. A caller that needs a different ceiling says so.
 *
 * **A day the file cannot hold never reaches the caller.** A year is only a year once it has four digits, so a date half typed
 * is refused exactly as one outside the range is: the caller keeps the day it had, and there is no day anywhere above this
 * control that the reader would go on to refuse the file for.
 *
 * **A required field says it is required once it has been left empty, and not before.** A form opens on the record it is about
 * to create and not on a refusal of a field nobody has been in yet; leave the field without a day in it, or take out the day
 * that was in it, and it says so from then on. Every required field in the application states it on those terms.
 */

// What each of the three formats is written as for the library, and which character separates its parts
const LIBRARY_DATE_FORMATS: Record<DateFormat, string> = {
	'DD/MM/YYYY': 'dd/MM/yyyy',
	'MM/DD/YYYY': 'MM/dd/yyyy',
	'YYYY-MM-DD': 'yyyy-MM-dd'
};

const DATE_FORMAT_SEPARATORS: Record<DateFormat, string> = {
	'DD/MM/YYYY': '/',
	'MM/DD/YYYY': '/',
	'YYYY-MM-DD': '-'
};

export interface DateFieldProps {

	// The day as the file holds it, or undefined when the field is empty
	value: IsoDate | undefined;

	// Called only with a day this field admits. A refused one leaves the caller holding what it had.
	onChange: (value: IsoDate | undefined) => void;

	// What the control is called, since the label is the caller's to place
	label: string;
	disabled?: boolean;
	required?: boolean;

	// The earliest day that can be chosen, where there is one
	minimum?: Date;

	// The latest day that can be chosen. Today, unless the caller says otherwise.
	maximum?: Date;
}

interface DateTextInputProps {
	label: string;
	separator: string;
	refusalId?: string;
	invalid?: boolean;
	value?: string;
	disabled?: boolean;
	placeholder?: string;
	onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
	ref?: Ref<HTMLInputElement>;

	// The library's own class, which is what tells its click-outside listener that a click in here is not outside
	className?: string;
}

// The typing is ours: a character that is neither a digit nor the separator of the format in force never lands in the box, and
// the class the library hands down is kept alongside our own: it is the one its click-outside listener ignores, so an input that
// drops it counts as outside itself and a second click closes the calendar and blurs the box the click had just put the caret in
const DateTextInput = ({ label, separator, refusalId, invalid, value, className, onChange, ref, ...rest }: DateTextInputProps): ReactElement => {
	return (
		<input
			{...rest}
			ref={ref}
			type='text'
			inputMode='numeric'
			autoComplete='off'
			className={`date-field-input${className ? ` ${className}` : ''}`}
			value={value ?? ''}
			aria-label={label}
			aria-invalid={invalid ? true : undefined}
			aria-describedby={invalid ? refusalId : undefined}
			onChange={(event) => {
				const typed = event.target.value;

				if(typed !== '' && !new RegExp(`^[\\d${separator === '-' ? '\\-' : separator}]*$`).test(typed)) {
					return;
				}

				onChange?.(event);
			}}/>
	);
};

/**
 * The one date control.
 * @param props The field's props.
 * @param props.value The day it holds.
 * @param props.onChange What to do with a day it admits.
 * @param props.label What the control is called.
 * @param props.disabled Whether it can be changed.
 * @param props.required Whether an empty field is a value the caller can be given.
 * @param props.minimum The earliest day it offers.
 * @param props.maximum The latest day it offers, today by default.
 * @returns The field.
 */
export const DateField = ({ value, onChange, label, disabled = false, required = false, minimum, maximum }: DateFieldProps): ReactElement => {
	const { t } = useTranslator();
	const { preferences } = usePreferences();
	const refusalId = useId();

	// A field nobody has been in yet is not covered in refusals: it is empty because the form has just opened
	const [ touched, setTouched ] = useState(false);
	const selected = DateUtils.fromStandardYearMonthDay(value);
	const latest = DateUtils.startOfDay(maximum ?? new Date());
	const isMissing = required && touched && !selected;

	const handleChange = (date: Date | null): void => {
		if(!date) {
			setTouched(true);
			onChange(undefined);

			return;
		}

		const day = DateUtils.startOfDay(date);

		// A day outside the range is refused rather than clamped: the caller keeps the day it had
		if(day.getTime() > latest.getTime() || (minimum && day.getTime() < DateUtils.startOfDay(minimum).getTime())) {
			return;
		}

		const standard = DateUtils.toStandardYearMonthDay(day);

		// A year half typed is a year: "01/02/202" is read as the second of February of the year 202, which is a real day the
		// range lets through and a day the file cannot hold. What the field cannot read back is what it never hands on, so the
		// day is put through the same reader the value arrives by and refused where it does not survive the round trip.
		if(!DateUtils.fromStandardYearMonthDay(standard)) {
			return;
		}

		onChange(standard);
	};

	return (
		<div
			className='date-field'
			onBlur={() => {
				setTouched(true);
			}}>
			<ReactDatePicker
				selected={selected ?? null}
				dateFormat={LIBRARY_DATE_FORMATS[preferences.dateFormat]}
				placeholderText={preferences.dateFormat}
				maxDate={latest}
				minDate={minimum}
				disabled={disabled}
				showPopperArrow={false}
				popperClassName='date-field-popper'
				calendarClassName='date-field-calendar'
				wrapperClassName='date-field-wrapper'
				onChange={handleChange}
				customInput={
					<DateTextInput
						label={label}
						separator={DATE_FORMAT_SEPARATORS[preferences.dateFormat]}
						refusalId={refusalId}
						invalid={isMissing}/>
				}/>
			{isMissing && <p className='date-field-refusal' id={refusalId}>{t('field.required')}</p>}
		</div>
	);
};
