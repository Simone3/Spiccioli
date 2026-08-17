import type { ReactElement } from 'react';
import { AppLinkButton } from 'src/components/common/AppButton';
import { EmptyState } from 'src/components/common/EmptyState';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * Transactions.
 *
 * The list, the seven filters and the inline editing are the phase after Accounts; what is here is the empty state, which names
 * both ways a row gets into the file.
 * @returns The screen.
 */
export const TransactionsScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();

	return (
		<ScreenLayout title={t('screens.transactions')}>
			{document && document.transactions.length === 0 ?
				<EmptyState message={t('emptyState.transactions')}>
					<AppLinkButton to={APP_ROUTES.bulkImport}>{t('emptyState.goToImport')}</AppLinkButton>
				</EmptyState> :
				<ScreenNotBuiltYet/>}
		</ScreenLayout>
	);
};
