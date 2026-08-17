import type { ReactElement } from 'react';
import { EmptyState } from 'src/components/common/EmptyState';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * Investments: holdings, purchases, sales and securities.
 *
 * Holdings is the tab the screen opens on and every holding begins with a purchase, so that is the empty state it carries.
 * @returns The screen.
 */
export const InvestmentsScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();

	return (
		<ScreenLayout title={t('screens.investments')}>
			{document && document.trades.length === 0 ?
				<EmptyState message={t('emptyState.investments')}/> :
				<ScreenNotBuiltYet/>}
		</ScreenLayout>
	);
};
