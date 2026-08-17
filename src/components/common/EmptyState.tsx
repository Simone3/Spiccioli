import 'src/components/common/EmptyState.css';
import type { ReactElement, ReactNode } from 'react';

/**
 * What a screen shows when there is nothing on it.
 *
 * **An empty screen names the action that fills it** — a sentence and the control that goes there — and never an empty table
 * with headers and never the words "no data". **Empty because of a filter is a different state** and says which filter is
 * hiding the rows and offers to clear it; both are this component, with different words and different controls.
 *
 * **A zero is not an empty state**: an account at € 0,00 and a check that passed render normally.
 */

export interface EmptyStateProps {
	message: string;

	// The buttons and links that fill the screen, where there are any
	children?: ReactNode;
}

/**
 * The empty state.
 * @param props The state's props.
 * @param props.message What there is nothing of, and what to do about it.
 * @param props.children The controls that do it.
 * @returns The empty state.
 */
export const EmptyState = ({ message, children }: EmptyStateProps): ReactElement => {
	return (
		<div className='empty-state'>
			<p className='empty-state-message'>{message}</p>
			{children && <div className='empty-state-actions'>{children}</div>}
		</div>
	);
};
