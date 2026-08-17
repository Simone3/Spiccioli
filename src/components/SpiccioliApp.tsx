import { type ReactElement } from 'react';
import { LaunchScreen } from 'src/components/launch/LaunchScreen';
import { SessionScreen } from 'src/components/session/SessionScreen';
import { WriteFailurePanel } from 'src/components/session/WriteFailurePanel';
import { useLedger } from 'src/contexts/LedgerContext';

/**
 * Which of the two states the application is in: no file, or one open.
 *
 * There is no third. A file is either open and fully editable or not open at all — there is no read-only mode — and the
 * application always starts here with no file, because it never reopens the last one on its own.
 *
 * The write-failure panel sits outside both, because the error it reports belongs to no screen.
 * @returns The application.
 */
export const SpiccioliApp = (): ReactElement => {
	const { document } = useLedger();

	return (
		<>
			{document ? <SessionScreen/> : <LaunchScreen/>}
			<WriteFailurePanel/>
		</>
	);
};
