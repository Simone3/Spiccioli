import type { ReactElement } from 'react';
import { DecimalField } from 'src/components/common/DecimalField';
import { fractionToPercentageTenths, PERCENTAGE_SCALE, percentageTenthsToFraction } from 'src/logic/format/NumberFormat';
import { MONEY_SCALES } from 'src/logic/money/Money';

/**
 * The shapes the one numeric field is used in.
 *
 * **Every monetary field in the application is the same field**: one control, at most two decimals, wherever an amount is
 * entered. A price is the one exception and carries four, a quantity carries six; a percentage carries one and is entered as
 * the percentage while the fraction is what is stored; a count carries none.
 *
 * Whether a field accepts a sign, whether zero is allowed and what its floor and ceiling are vary by field and are the caller's
 * to state. The shape never does.
 */

// The highest percentage any rate in the application is entered at, in the tenths a percentage is typed in
const HUNDRED_PERCENT_IN_TENTHS = 1000;

export interface NumericFieldProps {
	value: number | undefined;
	onChange: (value: number | undefined) => void;
	label: string;
	allowNegative?: boolean;
	minimum?: number;
	maximum?: number;
	required?: boolean;
	disabled?: boolean;

	// The unit a figure is counted in, where it has one: days, months
	suffix?: string;
}

export interface PercentageFieldProps {

	// The rate as it is stored: a fraction, in ten-thousandths
	value: number | undefined;

	onChange: (value: number | undefined) => void;
	label: string;
	required?: boolean;
	disabled?: boolean;
}

/**
 * An amount, in cents, with the currency every monetary figure carries.
 * @param props The field's props.
 * @returns The field.
 */
export const AmountField = (props: NumericFieldProps): ReactElement => {
	return <DecimalField {...props} scale={MONEY_SCALES.amount} prefix='€'/>;
};

/**
 * A unit price: money at four decimals.
 * @param props The field's props.
 * @returns The field.
 */
export const PriceField = (props: NumericFieldProps): ReactElement => {
	return <DecimalField {...props} scale={MONEY_SCALES.rate} prefix='€'/>;
};

/**
 * A quantity: six decimals and no currency, a broker selling fractional shares stating one to six.
 * @param props The field's props.
 * @returns The field.
 */
export const QuantityField = (props: NumericFieldProps): ReactElement => {
	return <DecimalField {...props} scale={MONEY_SCALES.quantity}/>;
};

/**
 * A whole number — a count, a number of days, a number of months.
 * @param props The field's props.
 * @returns The field.
 */
export const IntegerField = (props: NumericFieldProps): ReactElement => {
	return <DecimalField {...props} scale={0}/>;
};

/**
 * A rate, entered and shown as a percentage with at most one decimal, and stored as the fraction it names.
 * The conversion happens here and nowhere else, so nothing above this field ever holds a rate in the wrong units.
 * @param props The field's props.
 * @param props.value The rate, as the fraction that is stored.
 * @param props.onChange What to do with the fraction the percentage names.
 * @param props.label What the control is called.
 * @param props.required Whether an empty field is a value the caller can be given.
 * @param props.disabled Whether it can be typed into.
 * @returns The field.
 */
export const PercentageField = ({ value, onChange, label, required, disabled }: PercentageFieldProps): ReactElement => {
	return (
		<DecimalField
			value={value === undefined ? undefined : fractionToPercentageTenths(value)}
			scale={PERCENTAGE_SCALE}
			minimum={0}
			maximum={HUNDRED_PERCENT_IN_TENTHS}
			required={required}
			disabled={disabled}
			label={label}
			suffix='%'
			onChange={(percentageTenths) => {
				onChange(percentageTenths === undefined ? undefined : percentageTenthsToFraction(percentageTenths));
			}}/>
	);
};
