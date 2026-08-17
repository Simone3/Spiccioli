import type { ReactElement } from 'react';
import { ScreenLayout, ScreenNotBuiltYet } from 'src/components/shell/ScreenLayout';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * Checks.
 *
 * **This screen is never empty**: a check with nothing to examine passes and says so, which is why every passing check states
 * its reach. It therefore has no empty state to build — what it is waiting for is the fourteen checks themselves, which read
 * every other screen's records and are built after them.
 * @returns The screen.
 */
export const ChecksScreen = (): ReactElement => {
	const { t } = useTranslator();

	return (
		<ScreenLayout title={t('screens.checks')}>
			<ScreenNotBuiltYet/>
		</ScreenLayout>
	);
};
