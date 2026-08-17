import 'src/components/common/TextField.css';
import { useId, type ReactElement } from 'react';

/**
 * The one text field: a name, a description, a note.
 *
 * **Text is trimmed on save and not as it is typed**, so a name being typed keeps whatever whitespace the keyboard put in it
 * and the form is what decides that a field trimming to nothing is empty. Interior whitespace is left alone everywhere: bank
 * descriptions carry it and rules match on it.
 *
 * A refusal is stated beside the field and never in a modal, exactly as it is on the numeric one.
 */

export interface TextFieldProps {
	value: string;
	onChange: (value: string) => void;

	// What the control is called, since the label is the caller's to place
	label: string;
	placeholder?: string;
	disabled?: boolean;

	// Set by the caller when the value in the field is one the form cannot save
	refusal?: string;
}

/**
 * The text field.
 * @param props The field's props.
 * @param props.value What it holds.
 * @param props.onChange What to do with what was typed.
 * @param props.label What the control is called.
 * @param props.placeholder What it shows while it is empty.
 * @param props.disabled Whether it can be typed into.
 * @param props.refusal Why what it holds cannot be saved, where it cannot.
 * @returns The field.
 */
export const TextField = ({ value, onChange, label, placeholder, disabled = false, refusal }: TextFieldProps): ReactElement => {
	const refusalId = useId();

	return (
		<div className='text-field'>
			<input
				type='text'
				autoComplete='off'
				className={`text-field-input${refusal ? ' text-field-input-invalid' : ''}`}
				value={value}
				placeholder={placeholder}
				disabled={disabled}
				aria-label={label}
				aria-invalid={refusal ? true : undefined}
				aria-describedby={refusal ? refusalId : undefined}
				onChange={(event) => {
					onChange(event.target.value);
				}}/>
			{refusal && <p className='text-field-refusal' id={refusalId}>{refusal}</p>}
		</div>
	);
};
