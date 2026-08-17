import 'src/components/common/DecimalField.css';
import { useId, useState, type ChangeEvent, type ReactElement } from 'react';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatMinorUnitsAsPlainDecimal, MONEY_SCALES, parseDecimalToMinorUnits } from 'src/logic/money/Money';

/**
 * The one numeric field in the application, and the amount field of the validation specification is this control at two decimals.
 *
 * **Invalid input is refused as it is typed rather than on save.** A letter, a second separator, a sign where a sign is not
 * allowed, a decimal past the scale, a figure above the field's ceiling: none of them ever appears in the box. What cannot be
 * judged keystroke by keystroke — an empty required field, a figure below the field's floor — marks the field and states the
 * reason beside it, and **the value the caller holds is left exactly as it was**. Nothing here is ever rounded into shape.
 *
 * **The decimal character is the one the preferences name**, and a thousands separator is typeable under no setting at all.
 * Changing the preference changes which key produces the separator and nothing else: no figure already entered is re-read.
 */

export interface DecimalFieldProps {

	// The figure in the minor units its scale fixes, or undefined when the field is empty
	value: number | undefined;

	// Called only with a figure this field admits. A refused one leaves the caller holding what it had.
	onChange: (value: number | undefined) => void;

	// Decimal places the figure carries: two for an amount, four for a price or a quantity, one for a percentage, none for a count
	scale?: number;
	allowNegative?: boolean;

	// Both in the same minor units as the value
	minimum?: number;
	maximum?: number;
	required?: boolean;
	disabled?: boolean;

	// What the control is called, since the label is the caller's to place
	label: string;

	// The currency, the percent sign, the unit a count is counted in
	prefix?: string;
	suffix?: string;
}

const isAdmissibleText = (text: string, scale: number, allowNegative: boolean, decimalSeparator: string): boolean => {
	if(text === '') {
		return true;
	}

	const sign = allowNegative ? '-?' : '';
	const decimals = scale > 0 ? `(?:${decimalSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{0,${scale}})?` : '';

	return new RegExp(`^${sign}\\d*${decimals}$`).test(text);
};

/**
 * The one validated numeric control.
 * @param props The field's props.
 * @param props.value The figure it holds.
 * @param props.onChange What to do with a figure it admits.
 * @param props.scale Decimal places the figure carries, two by default.
 * @param props.allowNegative Whether a sign can be typed.
 * @param props.minimum The lowest figure it admits.
 * @param props.maximum The highest figure it admits.
 * @param props.required Whether an empty field is a value the caller can be given.
 * @param props.disabled Whether it can be typed into.
 * @param props.label What the control is called.
 * @param props.prefix What is shown before the figure.
 * @param props.suffix What is shown after it.
 * @returns The field.
 */
export const DecimalField = ({
	value,
	onChange,
	scale = MONEY_SCALES.amount,
	allowNegative = false,
	minimum,
	maximum,
	required = false,
	disabled = false,
	label,
	prefix,
	suffix
}: DecimalFieldProps): ReactElement => {
	const { t } = useTranslator();
	const { separators } = useFormatter();
	const refusalId = useId();

	// Held only while the field has the keyboard, so that a figure the preferences re-render arrives without fighting what is being typed
	const [ draft, setDraft ] = useState<string | undefined>(undefined);
	const [ refusal, setRefusal ] = useState<string | undefined>(undefined);

	const asText = (figure: number | undefined): string => {
		return figure === undefined ? '' : formatMinorUnitsAsPlainDecimal(figure, scale, separators.decimal);
	};

	const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
		const next = event.target.value;

		// Refused as it is typed: the box keeps what it had and there is nothing to say about a keystroke that never landed
		if(!isAdmissibleText(next, scale, allowNegative, separators.decimal)) {
			return;
		}

		setDraft(next);

		const parsed = parseDecimalToMinorUnits(next, scale, separators.decimal);

		if(parsed === undefined) {
			setRefusal(required ? t('field.required') : undefined);

			if(!required) {
				onChange(undefined);
			}

			return;
		}

		if(minimum !== undefined && parsed < minimum) {
			setRefusal(t('field.tooLow', { minimum: formatMinorUnitsAsPlainDecimal(minimum, scale, separators.decimal) }));

			return;
		}

		if(maximum !== undefined && parsed > maximum) {
			setRefusal(t('field.tooHigh', { maximum: formatMinorUnitsAsPlainDecimal(maximum, scale, separators.decimal) }));

			return;
		}

		setRefusal(undefined);
		onChange(parsed);
	};

	return (
		<div className='decimal-field'>
			<div className={`decimal-field-control${refusal ? ' decimal-field-control-invalid' : ''}${disabled ? ' decimal-field-control-disabled' : ''}`}>
				{prefix && <span className='decimal-field-affix' aria-hidden='true'>{prefix}</span>}
				<input
					type='text'
					inputMode='decimal'
					autoComplete='off'
					className='decimal-field-input'
					value={draft ?? asText(value)}
					disabled={disabled}
					aria-label={label}
					aria-invalid={refusal ? true : undefined}
					aria-describedby={refusal ? refusalId : undefined}
					onChange={handleChange}
					onFocus={() => {
						setDraft(asText(value));
					}}
					onBlur={() => {
						setDraft(undefined);
						setRefusal(undefined);
					}}/>
				{suffix && <span className='decimal-field-affix'>{suffix}</span>}
			</div>
			{refusal && <p className='decimal-field-refusal' id={refusalId}>{refusal}</p>}
		</div>
	);
};
