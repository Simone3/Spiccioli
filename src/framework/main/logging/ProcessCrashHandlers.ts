import { appLogger } from 'src/framework/main/logging/AppLogger';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';

/**
 * Leaves a trace of the failures nothing else catches.
 *
 * An exception that reaches the top of the main process, or a rejected promise nobody handled, otherwise takes the process down
 * or is swallowed without a word: no window, no log line, and nothing to tell the two apart afterwards. Both are logged here
 * first, and what to do about them is left to the application, because only it knows what it can still finish.
 */

export type FatalErrorKind = 'uncaught-exception' | 'unhandled-rejection';

export interface FatalError {
	kind: FatalErrorKind;
	message: string;
	stack: string | undefined;
}

// Only the part of Node's process the handlers are installed on, so a test can pass its own
export interface CrashHandlerProcess {
	on: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

export interface InstallProcessCrashHandlersOptions {
	process: CrashHandlerProcess;

	// Called once the failure has been logged. Installing these handlers stops the process from exiting on an uncaught exception,
	// so whether that is the right outcome is the application's decision to make here.
	onFatalError?: (fatalError: FatalError) => void;
}

const describeFatalError = (kind: FatalErrorKind, thrown: unknown): FatalError => {
	return {
		kind,
		message: getErrorMessage(thrown),
		stack: thrown instanceof Error ? thrown.stack : undefined
	};
};

export const installProcessCrashHandlers = ({
	process,
	onFatalError
}: InstallProcessCrashHandlersOptions): void => {
	const report = (kind: FatalErrorKind, thrown: unknown): void => {
		const fatalError = describeFatalError(kind, thrown);

		appLogger.error(fatalError.message, {
			type: fatalError.kind,
			stack: fatalError.stack
		});

		// A handler that throws would be the second uncaught exception in a row, and would replace the failure being reported with itself
		try {
			onFatalError?.(fatalError);
		}
		catch {
			// Intentionally ignored
		}
	};

	process.on('uncaughtException', (thrown) => {
		report('uncaught-exception', thrown);
	});

	process.on('unhandledRejection', (reason) => {
		report('unhandled-rejection', reason);
	});
};
