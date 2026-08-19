import { type ReactElement } from 'react';
import { LaunchScreen } from 'src/components/launch/LaunchScreen';
import { AppShell } from 'src/components/shell/AppShell';
import { TitleBar } from 'src/components/shell/TitleBar';
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
 *
 * The title bar sits above both for the same reason: where the window has none of its own it is what carries the menu and names the
 * open file, and the launch screen needs both as much as an open file does. It draws nothing at all on the platforms whose windows
 * keep a title bar.
 * @returns The application.
 */
export const SpiccioliApp = (): ReactElement => {
	const { document } = useLedger();

	return (
		<>
			<TitleBar/>
			{document ? <AppShell/> : <LaunchScreen/>}
			<WriteFailurePanel/>
			<UnsavedDraftPrompt/>
		</>
	);
};
