import 'src/components/common/FilterBar.css';
import type { ReactElement, ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The row of filters above a list, and the one control that clears them.
 *
 * Every filter takes one value or none, so clearing is a single gesture rather than a control per filter. **Clear filters is
 * offered only while something is set**: a bar with nothing on it has nothing to clear, and a screen showing nothing because of
 * a filter is a different state from a screen showing nothing because there is nothing.
 */

export interface FilterBarProps {

	// One "FilterBarFilter" per filter
	children: ReactNode;

	// Whether anything is set, which is what decides whether the clearing control is there
	isFiltered: boolean;

	onClear: () => void;
}

export interface FilterBarFilterProps {
	label: string;
	children: ReactNode;
}

/**
 * One filter, with its label above it.
 * @param props The filter's props.
 * @param props.label What it filters on.
 * @param props.children The control.
 * @returns The filter.
 */
export const FilterBarFilter = ({ label, children }: FilterBarFilterProps): ReactElement => {
	return (
		<div className='filter-bar-filter'>
			<span className='filter-bar-label'>{label}</span>
			{children}
		</div>
	);
};

/**
 * The bar the filters sit on.
 * @param props The bar's props.
 * @param props.children The filters.
 * @param props.isFiltered Whether anything is set.
 * @param props.onClear What clearing them does.
 * @returns The bar.
 */
export const FilterBar = ({ children, isFiltered, onClear }: FilterBarProps): ReactElement => {
	const { t } = useTranslator();

	return (
		<div className='filter-bar'>
			{children}
			{isFiltered && (
				<div className='filter-bar-clear'>
					<AppButton variant='ghost' onClick={onClear}>{t('filters.clear')}</AppButton>
				</div>
			)}
		</div>
	);
};
