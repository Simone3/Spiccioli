import 'src/components/common/TextField.css';
import { useId, type ReactElement } from 'react';

/**
 * The one text field: a name, a description, a note.
 *
 * **Text is trimmed on save and not as it is typed**, so a name being typed keeps whatever whitespace the keyboard put in it
 * and the form is what decides that a field trimming to nothing is empty. Interior whitespace is left alone everywhere: bank
 * descriptions carry it and rules match on it.
 *
 * A refusal is stated beside the field and never in a modal, exactly as it is on the numeric one. **The refusal is the
 * caller's**, this being the field whose emptiness only the form can judge — what a name being taken means, what a description
 * trimming to nothing means. `onBlur` is what the form marks a required field as left on, so that it states what it needs on
 * the one rule every required field in the application states it on.
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

	// Called when the field is left, which is when a form marks a required field as one that has been left empty
	onBlur?: () => void;
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
 * @param props.onBlur What leaving the field does, where the form marks it.
 * @returns The field.
 */
export const TextField = ({ value, onChange, label, placeholder, disabled = false, refusal, onBlur }: TextFieldProps): ReactElement => {
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
				}}
				onBlur={onBlur}/>
			{refusal && <p className='text-field-refusal' id={refusalId}>{refusal}</p>}
		</div>
	);
};
