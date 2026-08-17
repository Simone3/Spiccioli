import type { ReactElement } from 'react';
import { AppLinkButton } from 'src/components/common/AppButton';
import { EmptyState } from 'src/components/common/EmptyState';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The home screen, and the one an opened file always lands on.
 *
 * Every figure on it is somebody else's output, so it is the last screen built. What it has today is its empty state: a file
 * with no accounts in it has nothing to value, and what fills it is on Accounts.
 * @returns The screen.
 */
export const PortfolioScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();

	return (
		<ScreenLayout title={t('screens.portfolio')}>
			{document && document.accounts.length === 0 ?
				<EmptyState message={t('emptyState.portfolio')}>
					<AppLinkButton to={APP_ROUTES.accounts} variant='primary'>{t('emptyState.goToAccounts')}</AppLinkButton>
				</EmptyState> :
				<ScreenNotBuiltYet/>}
		</ScreenLayout>
	);
};
