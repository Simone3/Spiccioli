import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeAppLogger, resetAppLoggerForTests, type AppLogEntry } from 'src/framework/main/logging/AppLogger';
import { installProcessCrashHandlers, type CrashHandlerProcess, type FatalError } from 'src/framework/main/logging/ProcessCrashHandlers';

const TEST_LOG_FILE_NAME = 'app-logs.ndjson';

const logDirectories: string[] = [];

interface FakeProcess {
	process: CrashHandlerProcess;
	throwUncaughtException: (thrown: unknown) => void;
	rejectUnhandledPromise: (reason: unknown) => void;
}

// The two events the handlers are installed on, so a test can raise them without taking the test runner down with it
const createFakeProcess = (): FakeProcess => {
	const listeners = new Map<string, (...args: unknown[]) => void>();

	return {
		process: {
			on: (event, listener) => {
				listeners.set(event, listener);

				return undefined;
			}
		},
		throwUncaughtException: (thrown) => {
			listeners.get('uncaughtException')?.(thrown, 'uncaughtException');
		},
		rejectUnhandledPromise: (reason) => {
			listeners.get('unhandledRejection')?.(reason, Promise.resolve());
		}
	};
};

const startLogging = (): string => {
	const logDirectory = mkdtempSync(path.join(tmpdir(), 'crash-handlers-'));
	logDirectories.push(logDirectory);

	initializeAppLogger({
		logDirectory,
		fileName: TEST_LOG_FILE_NAME,
		maximumFileSizeBytes: 1024 * 1024,
		retainedArchiveCount: 1
	});

	return logDirectory;
};

const readLoggedEntries = (logDirectory: string): AppLogEntry[] => {
	const content = readFileSync(path.join(logDirectory, TEST_LOG_FILE_NAME), 'utf8').trim();

	if(!content) {
		return [];
	}

	return content.split(/\r?\n/).map((line) => {
		return JSON.parse(line) as AppLogEntry;
	});
};

describe('installProcessCrashHandlers', () => {
	afterEach(() => {
		resetAppLoggerForTests();

		for(const logDirectory of logDirectories.splice(0)) {
			rmSync(logDirectory, { recursive: true, force: true });
		}
	});

	test('logs an exception that reached the top of the process, with its stack', () => {
		const logDirectory = startLogging();
		const fake = createFakeProcess();

		installProcessCrashHandlers({ process: fake.process });
		fake.throwUncaughtException(new Error('Storage could not be opened'));

		const entries = readLoggedEntries(logDirectory);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			level: 'error',
			message: 'Storage could not be opened',
			type: 'uncaught-exception'
		});
		expect(entries[0]?.stack).toContain('Storage could not be opened');
	});

	test('logs a promise nobody handled', () => {
		const logDirectory = startLogging();
		const fake = createFakeProcess();

		installProcessCrashHandlers({ process: fake.process });
		fake.rejectUnhandledPromise(new Error('The backup folder went away'));

		expect(readLoggedEntries(logDirectory)[0]).toMatchObject({
			level: 'error',
			message: 'The backup folder went away',
			type: 'unhandled-rejection'
		});
	});

	test('describes the failure to the application', () => {
		startLogging();

		const fatalErrors: FatalError[] = [];
		const fake = createFakeProcess();

		installProcessCrashHandlers({
			process: fake.process,
			onFatalError: (fatalError) => {
				fatalErrors.push(fatalError);
			}
		});

		fake.throwUncaughtException(new Error('Storage could not be opened'));
		fake.rejectUnhandledPromise(new Error('The backup folder went away'));

		expect(fatalErrors.map(({ kind, message }) => {
			return { kind, message };
		})).toEqual([
			{ kind: 'uncaught-exception', message: 'Storage could not be opened' },
			{ kind: 'unhandled-rejection', message: 'The backup folder went away' }
		]);
	});

	test('reports a thrown value that is not an error, which has no stack of its own', () => {
		const logDirectory = startLogging();
		const fatalErrors: FatalError[] = [];
		const fake = createFakeProcess();

		installProcessCrashHandlers({
			process: fake.process,
			onFatalError: (fatalError) => {
				fatalErrors.push(fatalError);
			}
		});

		fake.rejectUnhandledPromise('the window went away');

		expect(readLoggedEntries(logDirectory)[0]).toMatchObject({
			level: 'error',
			message: 'the window went away'
		});
		expect(fatalErrors[0]?.stack).toBeUndefined();
	});

	test('keeps a handler that throws from becoming the next uncaught exception', () => {
		const logDirectory = startLogging();
		const fake = createFakeProcess();

		installProcessCrashHandlers({
			process: fake.process,
			onFatalError: () => {
				throw new Error('The error box could not be opened');
			}
		});

		expect(() => {
			fake.throwUncaughtException(new Error('Storage could not be opened'));
		}).not.toThrow();

		// The failure being reported is still the one that was logged
		expect(readLoggedEntries(logDirectory)[0]).toMatchObject({
			message: 'Storage could not be opened'
		});
	});
});
