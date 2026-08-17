import 'src/components/common/Chip.css';
import type { ReactElement, ReactNode } from 'react';

/**
 * The small label a row wears: an account's type, a receipt's state, a category a rule assigned.
 * It states something and does nothing, so it is never a control and never carries a click.
 */

export type ChipTone = 'neutral' | 'quiet' | 'accent' | 'danger';

const TONE_CLASS_NAMES: Record<ChipTone, string> = {
	neutral: '',
	quiet: ' chip-quiet',
	accent: ' chip-accent',
	danger: ' chip-danger'
};

export interface ChipProps {
	children: ReactNode;
	tone?: ChipTone;
}

/**
 * The chip.
 * @param props The chip's props.
 * @param props.children What it says.
 * @param props.tone How loudly it says it.
 * @returns The chip.
 */
export const Chip = ({ children, tone = 'neutral' }: ChipProps): ReactElement => {
	return <span className={`chip${TONE_CLASS_NAMES[tone]}`}>{children}</span>;
};
