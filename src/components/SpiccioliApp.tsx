import { type ReactElement } from 'react';
import { LaunchScreen } from 'src/components/launch/LaunchScreen';
import { AppShell } from 'src/components/shell/AppShell';
import { UnsavedDraftPrompt } from 'src/components/session/UnsavedDraftPrompt';
import { WriteFailurePanel } from 'src/components/session/WriteFailurePanel';
import { useLedger } from 'src/contexts/LedgerContext';

/**
 * Which of the two states the application is in: no file, or one open.
 *
 * There is no third. A file is either open and fully editable or not open at all — there is no read-only mode — and the
 * application always starts here with no file, because it never reopens the last one on its own.
 *
 * The write-failure panel and the unsaved-draft prompt sit outside both, because neither belongs to a screen: one reports an
 * error about the file, and the other guards the three ways of walking away from something that has not been written.
 * @returns The application.
 */
export const SpiccioliApp = (): ReactElement => {
	const { document } = useLedger();

	return (
		<>
			{document ? <AppShell/> : <LaunchScreen/>}
			<WriteFailurePanel/>
			<UnsavedDraftPrompt/>
		</>
	);
};
