import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { EOL, tmpdir } from 'node:os';
import path from 'node:path';
import { appLogger as processAppLogger, createAppLogger, initializeAppLogger, LOG_WRITE_FAILED_MESSAGE, LOGGER_NOT_INITIALIZED_MESSAGE, resetAppLoggerForTests, type AppLogEntry, type AppLogFields, type AppLogger, type CreateAppLoggerBackend, type CreateAppLoggerOptions } from 'src/framework/main/logging/AppLogger';

const TEST_LOG_FILE_NAME = 'app-logs.ndjson';

const TEST_RETAINED_ARCHIVE_COUNT = 1;

// The framework logger takes every setting from its caller, so the tests supply one baseline and override only what they exercise
const createTestLoggerOptions = (options: Partial<CreateAppLoggerOptions> & Pick<CreateAppLoggerOptions, 'logDirectory'>): CreateAppLoggerOptions => {
	return {
		fileName: TEST_LOG_FILE_NAME,
		maximumFileSizeBytes: 1024 * 1024,
		retainedArchiveCount: TEST_RETAINED_ARCHIVE_COUNT,
		...options
	};
};

const createTestLogger = (options: Partial<CreateAppLoggerOptions> & Pick<CreateAppLoggerOptions, 'logDirectory'>) => {
	return createAppLogger(createTestLoggerOptions(options));
};

const makeTempLogDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'app-logger-'));
};

const readAppLogEntries = (logDirectory: string): AppLogEntry[] => {
	const content = readFileSync(path.join(logDirectory, TEST_LOG_FILE_NAME), 'utf8').trim();

	if(!content) {
		return [];
	}

	return content.split(/\r?\n/).map((line) => {
		return JSON.parse(line) as AppLogEntry;
	});
};

// Each entry is wider than the size limit the rolling tests use, so every write rolls the file at most once and the count is
// what decides how many times it rolls
const writeRollingLogEntries = (logger: AppLogger, entryCount: number): void => {
	for(let index = 0; index < entryCount; index += 1) {
		logger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: `SELECT '${'x'.repeat(80)}-${index}'`
		});
	}
};

const readLogFileNames = (logDirectory: string): string[] => {
	return readdirSync(logDirectory).filter((fileName) => {
		return fileName.startsWith('app-logs');
	}).sort();
};

const createFakeBackendFactory = (write: (message: string) => void): CreateAppLoggerBackend => {
	return () => {
		return {
			debug: write,
			error: write,
			info: write,
			warn: write,
			transports: {
				console: {
					level: 'info'
				},
				file: {
					level: 'info',
					fileName: '',
					format: ({ data }) => {
						return data;
					},
					maxSize: 0,
					archiveLogFn: () => {
						return undefined;
					},
					resolvePathFn: () => {
						return '';
					},
					sync: false
				},
				ipc: {
					level: 'info'
				},
				remote: {
					level: 'info'
				}
			}
		};
	};
};

describe('AppLogger', () => {
	const tempStorageDirectories: string[] = [];

	afterEach(async() => {
		await processAppLogger.flush();
		resetAppLoggerForTests();

		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('keeps the process-wide logger safe before initialization', async() => {
		expect(processAppLogger.getStatus()).toEqual({
			state: 'unavailable',
			message: LOGGER_NOT_INITIALIZED_MESSAGE
		});
		expect(() => {
			processAppLogger.info('Ignored before startup initialization');
		}).not.toThrow();
		await expect(processAppLogger.flush()).resolves.toBeUndefined();
		expect(() => {
			processAppLogger.getConfiguration();
		}).toThrow(LOGGER_NOT_INITIALIZED_MESSAGE);
	});

	test('exposes initialized logging through a stable process-wide utility', () => {
		const processLogger = processAppLogger;
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');

		initializeAppLogger(createTestLoggerOptions({
			logDirectory,
			now: () => {
				return createdAt;
			}
		}));

		expect(processAppLogger).toBe(processLogger);
		processAppLogger.info('Process logger initialized', {
			type: 'main.startup'
		});

		expect(readAppLogEntries(logDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Process logger initialized',
				type: 'main.startup'
			}
		]);
	});

	test('writes structured newline-delimited JSON entries for public log levels', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const logger = createTestLogger({
			logDirectory,
			now: () => {
				return createdAt;
			}
		});

		logger.info('React storage command received', {
			type: 'react.command',
			command: 'task.create'
		});
		logger.warn('Storage warning', {
			type: 'storage.warning'
		});
		logger.error('Storage SQL query failed', {
			type: 'sql.query',
			elapsedMillis: 3
		});
		logger.debug('Storage debug detail', {
			type: 'storage.debug'
		});

		expect(readAppLogEntries(logDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'React storage command received',
				type: 'react.command',
				command: 'task.create'
			},
			{
				createdAt: createdAt.toISOString(),
				level: 'warn',
				message: 'Storage warning',
				type: 'storage.warning'
			},
			{
				createdAt: createdAt.toISOString(),
				level: 'error',
				message: 'Storage SQL query failed',
				type: 'sql.query',
				elapsedMillis: 3
			},
			{
				createdAt: createdAt.toISOString(),
				level: 'debug',
				message: 'Storage debug detail',
				type: 'storage.debug'
			}
		]);
		expect(logger.getStatus()).toEqual({
			state: 'healthy'
		});
	});

	test('creates the log directory before checking startup writability', () => {
		const parentDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(parentDirectory);
		const logDirectory = path.join(parentDirectory, 'storage');
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const logger = createTestLogger({
			logDirectory,
			now: () => {
				return createdAt;
			}
		});

		logger.info('Logger directory created', {
			type: 'main.startup'
		});

		expect(logger.getStatus()).toEqual({
			state: 'healthy'
		});
		expect(readAppLogEntries(logDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Logger directory created',
				type: 'main.startup'
			}
		]);
	});

	test('reports unavailable startup logging when the log file cannot be opened', () => {
		const parentDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(parentDirectory);
		const logDirectory = path.join(parentDirectory, 'not-a-directory');
		writeFileSync(logDirectory, 'file', 'utf8');

		const logger = createTestLogger({
			logDirectory,
			backendFactory: createFakeBackendFactory(() => {
				return undefined;
			})
		});

		expect(logger.getStatus()).toEqual({
			state: 'unavailable',
			message: expect.stringContaining('Could not open')
		});
		expect(logger.getStatus()).toEqual({
			state: 'unavailable',
			message: expect.stringContaining(LOG_WRITE_FAILED_MESSAGE)
		});
		expect(() => {
			logger.info('Startup logging is unavailable');
		}).not.toThrow();
	});

	test('rolls the log file into a numbered archive once it passes the size limit', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const logger = createTestLogger({
			logDirectory,
			maximumFileSizeBytes: 180
		});

		writeRollingLogEntries(logger, 8);

		const configuration = logger.getConfiguration();

		expect(configuration.maximumFileSizeBytes).toBe(180);
		expect(configuration.retainedArchiveCount).toBe(TEST_RETAINED_ARCHIVE_COUNT);
		expect(readLogFileNames(logDirectory)).toEqual([ TEST_LOG_FILE_NAME, 'app-logs.old.1.ndjson' ]);
	});

	test('keeps as many archives as it was asked to and drops the oldest', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const logger = createTestLogger({
			logDirectory,
			maximumFileSizeBytes: 180,
			retainedArchiveCount: 3
		});

		writeRollingLogEntries(logger, 60);

		// The archives are numbered from the newest, and the log directory never holds more than the current file and those three
		const logFileNames = readLogFileNames(logDirectory);

		expect(logFileNames).toEqual([
			TEST_LOG_FILE_NAME,
			'app-logs.old.1.ndjson',
			'app-logs.old.2.ndjson',
			'app-logs.old.3.ndjson'
		]);

		// Rolled far enough that the earliest entries fell off the end, which is what the retention count is there to bound
		const everyRetainedEntry = logFileNames.map((fileName) => {
			return readFileSync(path.join(logDirectory, fileName), 'utf8');
		}).join('');

		expect(everyRetainedEntry).not.toContain('-0\'');
		expect(everyRetainedEntry).toContain('-59\'');
	});

	test('keeps no archive at all when it was asked for none', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const logger = createTestLogger({
			logDirectory,
			maximumFileSizeBytes: 180,
			retainedArchiveCount: 0
		});

		writeRollingLogEntries(logger, 20);

		expect(readLogFileNames(logDirectory)).toEqual([ TEST_LOG_FILE_NAME ]);
	});

	test('writes every entry before the call that logged it returns', async() => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const appLogPath = path.join(logDirectory, TEST_LOG_FILE_NAME);
		const backendFactory = createFakeBackendFactory((message) => {
			appendFileSync(appLogPath, `${message}${EOL}`, 'utf8');
		});
		const logger = createTestLogger({
			logDirectory,
			backendFactory
		});

		logger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT written_synchronously'
		});

		// Nothing is awaited here on purpose: the entries describing a crash are worth having only if they reach the file before it
		expect(readAppLogEntries(logDirectory)).toEqual([
			expect.objectContaining({
				level: 'info',
				message: 'Storage SQL query completed',
				type: 'sql.query',
				query: 'SELECT written_synchronously'
			})
		]);

		// Which is also why there is never anything left for the shutdown flush to wait for
		await expect(logger.flush()).resolves.toBeUndefined();
	});

	test('ignores a write the log file could not receive', async() => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const backendFactory = createFakeBackendFactory(() => {
			throw new Error('The log file is gone.');
		});
		const logger = createTestLogger({
			logDirectory,
			backendFactory
		});

		// The log is a diagnostic trace, so losing an entry must never reach the caller and must never make logging look broken
		expect(() => {
			logger.info('Storage SQL query completed', {
				type: 'sql.query',
				query: 'SELECT write_failure'
			});
		}).not.toThrow();

		await expect(logger.flush()).resolves.toBeUndefined();
		expect(logger.getStatus()).toEqual({
			state: 'healthy'
		});
	});

	test('ignores an entry holding a value JSON cannot represent', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const writtenLines: string[] = [];
		const backendFactory = createFakeBackendFactory((message) => {
			writtenLines.push(message);
		});
		const logger = createTestLogger({
			logDirectory,
			backendFactory
		});
		const circularFields: AppLogFields = {
			type: 'sql.query'
		};
		circularFields.circular = circularFields;

		expect(() => {
			logger.info('Storage SQL query completed', circularFields);
		}).not.toThrow();
		expect(writtenLines).toEqual([]);
	});

	test('writes the level in force and everything more severe, and drops the rest', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const logger = createTestLogger({
			logDirectory,
			level: 'info'
		});

		logger.debug('Dropped by the level in force');
		logger.info('Storage SQL query completed');
		logger.warn('A write attempt failed');
		logger.error('A write failed for good');

		expect(readAppLogEntries(logDirectory).map((entry) => {
			return entry.level;
		})).toEqual([ 'info', 'warn', 'error' ]);
		expect(logger.getConfiguration().level).toBe('info');
	});

	test('writes everything when the level is the lowest and nothing but errors when it is the highest', () => {
		const everyLevel = (logger: AppLogger): void => {
			logger.debug('Tracing');
			logger.info('Something happened');
			logger.warn('Something is off');
			logger.error('Something failed');
		};
		const debugDirectory = makeTempLogDirectory();
		const errorDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(debugDirectory, errorDirectory);

		everyLevel(createTestLogger({ logDirectory: debugDirectory, level: 'debug' }));
		everyLevel(createTestLogger({ logDirectory: errorDirectory, level: 'error' }));

		expect(readAppLogEntries(debugDirectory)).toHaveLength(4);
		expect(readAppLogEntries(errorDirectory).map((entry) => {
			return entry.level;
		})).toEqual([ 'error' ]);
	});

	// The level is a preference, and a preference applies the moment it is changed rather than at the next start
	test('changes the level in force without being rebuilt', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const logger = createTestLogger({
			logDirectory,
			level: 'error'
		});

		logger.debug('Dropped while the level is errors only');
		logger.setLevel('debug');
		logger.debug('Written once the level admits it');

		expect(readAppLogEntries(logDirectory).map((entry) => {
			return entry.message;
		})).toEqual([ 'Written once the level admits it' ]);
		expect(logger.getConfiguration().level).toBe('debug');
	});

	// Nothing below the level is serialized at all, so a field JSON cannot represent cannot even throw on the way out
	test('never serializes an entry the level drops', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const writtenLines: string[] = [];
		const backendFactory = createFakeBackendFactory((message) => {
			writtenLines.push(message);
		});
		const serialize = vi.fn(() => {
			return 'never asked for';
		});
		const logger = createTestLogger({
			logDirectory,
			backendFactory,
			level: 'warn'
		});

		logger.debug('Dropped by the level in force', { type: 'sql.query', toJSON: serialize });

		expect(serialize).not.toHaveBeenCalled();
		expect(writtenLines).toEqual([]);
	});
});
