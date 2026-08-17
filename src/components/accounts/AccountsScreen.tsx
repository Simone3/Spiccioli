import type { ReactElement } from 'react';
import { EmptyState } from 'src/components/common/EmptyState';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * Accounts, which is the spine every other screen hangs off.
 *
 * The two tabs, the forms and the rules that later phases lean on are the next phase's; what is here is the empty state, whose
 * sentence is what the file starts as.
 * @returns The screen.
 */
export const AccountsScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();

	return (
		<ScreenLayout title={t('screens.accounts')}>
			{document && document.accounts.length === 0 ?
				<EmptyState message={t('emptyState.accounts')}/> :
				<ScreenNotBuiltYet/>}
		</ScreenLayout>
	);
};
