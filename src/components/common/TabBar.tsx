import 'src/components/common/TabBar.css';
import type { ReactElement } from 'react';

/**
 * The tabs a screen with more than one list is divided into.
 *
 * **A tab is a real button**, so the keyboard reaches it and activates it and the one focus ring has something to draw around.
 * Which tab is showing is the screen's own state and never a route: the eight routes are the eight sidebar entries and a tab is
 * not one of them.
 */

export interface TabBarTab {
	key: string;
	label: string;
}

export interface TabBarProps {
	tabs: readonly TabBarTab[];

	// The key of the tab that is showing
	active: string;

	onSelect: (key: string) => void;

	// What the set of tabs is called, which is what tells one screen's tabs from another's
	label: string;
}

/**
 * The tabs.
 * @param props The bar's props.
 * @param props.tabs The tabs, in the order they are shown.
 * @param props.active Which one is showing.
 * @param props.onSelect What choosing one does.
 * @param props.label What the set is called.
 * @returns The bar.
 */
export const TabBar = ({ tabs, active, onSelect, label }: TabBarProps): ReactElement => {
	return (
		<div className='tab-bar' role='tablist' aria-label={label}>
			{tabs.map((tab) => {
				return (
					<button
						key={tab.key}
						type='button'
						role='tab'
						className={tab.key === active ? 'tab-bar-tab tab-bar-tab-active' : 'tab-bar-tab'}
						aria-selected={tab.key === active}
						onClick={() => {
							onSelect(tab.key);
						}}>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
};
