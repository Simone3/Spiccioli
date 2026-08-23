import path from 'node:path';
import { LEDGER_FILE_CONFIG } from 'src/config/AppConfig';

/**
 * The ledger a launch was asked to open, read off its command line.
 *
 * Windows and Linux hand a document over by starting the application with its path as an argument, and that is as true of the
 * launch that starts Spiccioli as of the one the single-instance lock refuses. macOS does not: it sends an event instead, which
 * `Main.ts` listens for, so on that platform nothing here ever finds anything.
 *
 * **Only a path carrying the ledger's own extension is one**, and everything else on the command line is left where it is.
 * Chromium and Electron both put switches there and `npm start` puts the project directory there, and none of them is a file
 * anybody asked for.
 */

export interface FindLedgerFileArgumentOptions {

	// The command line, as the process received it
	argv: string[];

	// A development run is Electron started on the project directory, so it carries one argument before the user's that a
	// packaged run does not
	isPackaged: boolean;

	// What a relative path is relative to. A second launch is started from wherever the user was, which is not this process's
	// own working directory.
	workingDirectory: string;
}

// The absolute path of the ledger the command line asked for, or nothing where it asked for none
export const findLedgerFileArgument = ({
	argv,
	isPackaged,
	workingDirectory
}: FindLedgerFileArgumentOptions): string | undefined => {
	// The executable is always first, and the directory Electron was started on is second in a development run
	const requested = argv.slice(isPackaged ? 1 : 2).find((argument) => {
		return !argument.startsWith('-') && path.extname(argument).toLowerCase() === LEDGER_FILE_CONFIG.extension;
	});

	return requested === undefined ? undefined : path.resolve(workingDirectory, requested);
};
