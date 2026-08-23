import 'src/components/common/SelectField.css';
import { useId, type ReactElement } from 'react';

/**
 * A picker over a closed set.
 *
 * Every set it is used over is closed, so **there is nothing here to reject**: the only values offered are the legal ones, and
 * a picker never carries a clearing entry it was not given. Where a choice can still be refused — the two separators that must
 * differ — the caller says so and the reason is stated beside the control, with the previous value left in force.
 */

export interface SelectOption<TValue extends string> {
	value: TValue;
	label: string;
}

export interface SelectFieldProps<TValue extends string> {
	value: TValue;
	options: readonly SelectOption<TValue>[];
	onChange: (value: TValue) => void;

	// What the control is called, since the label is the caller's to place
	label: string;
	disabled?: boolean;

	// Set by the caller when the choice just made could not be applied
	refusal?: string;

	// Called when the picker is left, which is when a form marks a required choice as one that has been left unmade
	onBlur?: () => void;
}

/**
 * The one picker.
 * @param props The picker's props.
 * @param props.value Which of the values is in force.
 * @param props.options The closed set, in the order it is offered in.
 * @param props.onChange What to do with the value chosen.
 * @param props.label What the control is called.
 * @param props.disabled Whether it can be changed.
 * @param props.refusal Why the last choice was not applied, where it was not.
 * @param props.onBlur What leaving the picker does, where the form marks it.
 * @returns The picker.
 */
export const SelectField = <TValue extends string>({
	value,
	options,
	onChange,
	label,
	disabled = false,
	refusal,
	onBlur
}: SelectFieldProps<TValue>): ReactElement => {
	const refusalId = useId();

	return (
		<div className='select-field'>
			{/* The wrapper is what the arrow is drawn on, the platform's own being fixed against the border */}
			<div className='select-field-wrapper'>
				<select
					className={`select-field-control${refusal ? ' select-field-control-invalid' : ''}`}
					value={value}
					disabled={disabled}
					aria-label={label}
					aria-invalid={refusal ? true : undefined}
					aria-describedby={refusal ? refusalId : undefined}
					onChange={(event) => {
						onChange(event.target.value as TValue);
					}}
					onBlur={onBlur}>
					{options.map((option) => {
						return <option key={option.value} value={option.value}>{option.label}</option>;
					})}
				</select>
			</div>
			{refusal && <p className='select-field-refusal' id={refusalId}>{refusal}</p>}
		</div>
	);
};
