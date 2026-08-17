import type { ReactElement } from 'react';
import { EmptyState } from 'src/components/common/EmptyState';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * Categories: the category list, the rules and the report.
 *
 * The list itself is never empty — the categories are seeded into every new file — so the empty state this screen has is the
 * rules': nothing is categorised automatically until a rule says so.
 * @returns The screen.
 */
export const CategoriesScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();

	return (
		<ScreenLayout title={t('screens.categories')}>
			{document && document.rules.length === 0 ?
				<EmptyState message={t('emptyState.categories')}/> :
				<ScreenNotBuiltYet/>}
		</ScreenLayout>
	);
};
