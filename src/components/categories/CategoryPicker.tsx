import { useMemo, type ReactElement } from 'react';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { sortCategories } from 'src/logic/categories/Categories';
import { UNCATEGORISED_FILTER } from 'src/logic/transactions/Transactions';
import type { LedgerId } from 'src/types/LedgerTypes';

/**
 * **Every category picker in the application is this control**: a transaction's, a filter's, a rule's.
 *
 * The twenty-seven categories are offered **alphabetically**, and the only entries outside the alphabet are the two that are not
 * categories — *Automatic* at the top of the picker that assigns one, *Uncategorised* at the top of the one that filters by one.
 * **The assigning picker carries no clearing entry**, which is what makes the only empty category in the file one no rule
 * matched: a category set by hand can be handed back to the rules and never taken away.
 */

// The entry that hands a transaction back to the rules. It is a value the picker returns and never a category id.
export const AUTOMATIC_CATEGORY = 'automatic';

// The entry a filter opens on, which is no category filter at all
const ALL_CATEGORIES = '';

export type CategoryPickerMode = 'assign' | 'filter';

export interface CategoryPickerProps {

	// The category chosen, or "AUTOMATIC_CATEGORY", or "UNCATEGORISED_FILTER", or undefined for a filter that is not set
	value: LedgerId | undefined;

	onChange: (value: string) => void;

	// Which of the two entries outside the alphabet this picker carries
	mode: CategoryPickerMode;

	// What the control is called, since the label is the caller's to place
	label: string;
	disabled?: boolean;
}

/**
 * The one category picker.
 * @param props The picker's props.
 * @param props.value The category chosen, or the entry outside the alphabet that is.
 * @param props.onChange What to do with the value chosen.
 * @param props.mode Whether it assigns a category or filters by one.
 * @param props.label What the control is called.
 * @param props.disabled Whether it can be changed.
 * @returns The picker.
 */
export const CategoryPicker = ({ value, onChange, mode, label, disabled }: CategoryPickerProps): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();
	const categories = document?.categories;

	const options = useMemo((): readonly SelectOption<string>[] => {
		const leading: SelectOption<string> = mode === 'assign' ?
			{ value: AUTOMATIC_CATEGORY, label: t('categoryPicker.automatic') } :
			{ value: ALL_CATEGORIES, label: t('categoryPicker.all') };

		const uncategorised: readonly SelectOption<string>[] = mode === 'filter' ?
			[ { value: UNCATEGORISED_FILTER, label: t('categoryPicker.uncategorised') } ] :
			[];

		return [ leading, ...uncategorised, ...sortCategories(categories ?? []).map((category) => {
			return { value: category.id, label: category.name };
		}) ];
	}, [ categories, mode, t ]);

	return (
		<SelectField
			value={value ?? ALL_CATEGORIES}
			options={options}
			label={label}
			disabled={disabled}
			onChange={onChange}/>
	);
};
