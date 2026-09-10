import 'src/components/common/SegmentedControl.css';
import type { ReactElement } from 'react';

/**
 * A choice over a closed set of a few, made in one click and with every option on the screen: the window a chart is read over.
 *
 * **It is a group of real buttons and not a tab bar**, though it looks like one from a distance. A tab names a panel and there
 * is none here — what is chosen changes one thing about what is already showing — so the group carries `role='group'` and each
 * button says whether it is the one pressed. **It is not a select either**: a control that is flipped back and forth to compare
 * two readings should not hide the readings behind a click.
 *
 * **Every option is a real button**, so the keyboard reaches it and activates it and the one focus ring has something to draw
 * around. The group leaves the ring room rather than clipping it: the buttons are inset in it and it never hides what overflows.
 */

export interface SegmentedControlOption<Key extends string> {
	key: Key;
	label: string;
}

export interface SegmentedControlProps<Key extends string> {
	options: readonly SegmentedControlOption<Key>[];

	// The key of the option that is chosen. One always is.
	value: Key;

	onChange: (key: Key) => void;

	// What the set of options is over, which is what tells one control's segments from another's
	label: string;
}

/**
 * The control.
 * @param props The control's props.
 * @param props.options The options, in the order they are shown.
 * @param props.value Which one is chosen.
 * @param props.onChange What choosing one does.
 * @param props.label What the set is over.
 * @returns The control.
 */
export const SegmentedControl = <Key extends string>({
	options,
	value,
	onChange,
	label
}: SegmentedControlProps<Key>): ReactElement => {
	return (
		<div className='segmented-control' role='group' aria-label={label}>
			{options.map((option) => {
				return (
					<button
						key={option.key}
						type='button'
						className={option.key === value ? 'segmented-control-option segmented-control-option-chosen' : 'segmented-control-option'}
						aria-pressed={option.key === value}
						onClick={() => {
							onChange(option.key);
						}}>
						{option.label}
					</button>
				);
			})}
		</div>
	);
};
