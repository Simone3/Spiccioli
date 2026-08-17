import type { ReactElement } from 'react';
import { AppLinkButton } from 'src/components/common/AppButton';
import { EmptyState } from 'src/components/common/EmptyState';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { CASH_ACCOUNT_TYPES } from 'src/types/LedgerTypes';

/**
 * Bulk import, which is reached from Transactions rather than from the sidebar.
 *
 * The paste, the preview and the three format controls are the phase after Transactions. What is here is the state that comes
 * before any of it: **a file with no cash account has nothing to import into**, and the screen points at Accounts.
 * @returns The screen.
 */
export const BulkImportScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();
	const hasCashAccount = document?.accounts.some((account) => {
		return CASH_ACCOUNT_TYPES.includes(account.type);
	}) ?? false;

	return (
		<ScreenLayout title={t('screens.bulkImport')}>
			{hasCashAccount ?
				<ScreenNotBuiltYet/> :
				<EmptyState message={t('emptyState.bulkImport')}>
					<AppLinkButton to={APP_ROUTES.accounts} variant='primary'>{t('emptyState.goToAccounts')}</AppLinkButton>
				</EmptyState>}
		</ScreenLayout>
	);
};
