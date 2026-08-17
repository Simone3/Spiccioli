import type { ReactElement } from 'react';
import { EmptyState } from 'src/components/common/EmptyState';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * Salaries: the contracts and the payslips that divide by them.
 *
 * Nothing on the payslips tab means anything without a contract, so the contract's own empty state is what an empty file shows.
 * @returns The screen.
 */
export const SalariesScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document } = useLedger();

	return (
		<ScreenLayout title={t('screens.salaries')}>
			{document && document.contracts.length === 0 ?
				<EmptyState message={t('emptyState.salaries')}/> :
				<ScreenNotBuiltYet/>}
		</ScreenLayout>
	);
};
