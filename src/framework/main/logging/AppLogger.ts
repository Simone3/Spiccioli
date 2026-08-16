import { closeSync, existsSync, mkdirSync, openSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import electronLog from 'electron-log';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';

export const LOG_WRITE_FAILED_MESSAGE = 'Logging is unavailable.';

export const LOGGER_NOT_INITIALIZED_MESSAGE = 'Logging has not been initialized.';

export type AppLogLevel = 'info' | 'warn' | 'error' | 'debug';

type ElectronLogLevel = AppLogLevel | 'verbose' | 'silly' | false;

export type AppLogFields = {
	type?: string;
	[field: string]: unknown;
};

export interface AppLogEntry extends AppLogFields {
	createdAt: string;
	level: AppLogLevel;
	message: string;
}

interface AppLogTransport {
	level: ElectronLogLevel;
}

interface AppLogFileTransport extends AppLogTransport {
	fileName: string;
	format: (params: { data: unknown[] }) => unknown[];
	maxSize: number;

	// Called with the file that just passed the size limit. The parameter is deliberately unknown: the backend hands over its own
	// file object rather than a path, and the only thing that may be assumed about it is that it describes itself as one.
	archiveLogFn: (oldLogFile: unknown) => void;
	resolvePathFn: () => string;
	sync: boolean;
}

export interface AppLoggerBackend {
	debug: (message: string) => void;
	error: (message: string) => void;
	info: (message: string) => void;
	warn: (message: string) => void;
	transports: {
		console?: AppLogTransport | null;
		file: AppLogFileTransport;
		ipc?: AppLogTransport | null;
		remote?: AppLogTransport | null;
	};
}

export type CreateAppLoggerBackend = (logId: string) => AppLoggerBackend;

export interface AppLoggerConfiguration {
	filePath: string;
	fileName: string;
	maximumFileSizeBytes: number;
	retainedArchiveCount: number;
}

export interface AppLoggerHealthyStatus {
	state: 'healthy';
}

export interface AppLoggerUnavailableStatus {
	state: 'unavailable';
	message: string;
}

export type AppLoggerStatus = AppLoggerHealthyStatus | AppLoggerUnavailableStatus;

export interface CreateAppLoggerOptions {
	logDirectory: string;
	fileName: string;
	maximumFileSizeBytes: number;
	retainedArchiveCount: number;
	backendFactory?: CreateAppLoggerBackend;
	now?: () => Date;
}

export interface AppLogger {
	debug: (message: string, fields?: AppLogFields) => void;
	error: (message: string, fields?: AppLogFields) => void;
	info: (message: string, fields?: AppLogFields) => void;
	warn: (message: string, fields?: AppLogFields) => void;
	flush: () => Promise<void>;
	getStatus: () => AppLoggerStatus;
	getConfiguration: () => AppLoggerConfiguration;
}

const createElectronLoggerBackend: CreateAppLoggerBackend = (logId) => {
	return electronLog.create({ logId }) as unknown as AppLoggerBackend;
};

const createUninitializedAppLogger = (): AppLogger => {
	return {
		debug: () => {
			return undefined;
		},
		error: () => {
			return undefined;
		},
		info: () => {
			return undefined;
		},
		warn: () => {
			return undefined;
		},
		flush: () => {
			return Promise.resolve();
		},
		getStatus: () => {
			return {
				state: 'unavailable',
				message: LOGGER_NOT_INITIALIZED_MESSAGE
			};
		},
		getConfiguration: () => {
			throw new Error(LOGGER_NOT_INITIALIZED_MESSAGE);
		}
	};
};

let activeAppLogger = createUninitializedAppLogger();

// The process-wide logger. Every module writes through this handle, so that logging can be initialized once at startup without threading a logger through every call.
export const appLogger: AppLogger = {
	debug: (message, fields) => {
		activeAppLogger.debug(message, fields);
	},
	error: (message, fields) => {
		activeAppLogger.error(message, fields);
	},
	info: (message, fields) => {
		activeAppLogger.info(message, fields);
	},
	warn: (message, fields) => {
		activeAppLogger.warn(message, fields);
	},
	flush: () => {
		return activeAppLogger.flush();
	},
	getStatus: () => {
		return activeAppLogger.getStatus();
	},
	getConfiguration: () => {
		return activeAppLogger.getConfiguration();
	}
};

const createLogId = (logDirectory: string): string => {
	return `app-logger-${logDirectory.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
};

/**
 * Builds the name of one archive, numbered from the newest.
 * `app-logs.ndjson` archives as `app-logs.old.1.ndjson`, `app-logs.old.2.ndjson`, and so on.
 * @param filePath Path of the log file being archived.
 * @param archiveIndex Archive position, starting at 1 for the newest.
 * @returns The path of that archive.
 */
const createArchiveFilePath = (filePath: string, archiveIndex: number): string => {
	const { dir, name, ext } = path.parse(filePath);

	return path.join(dir, `${name}.old.${archiveIndex}${ext}`);
};

/**
 * Builds the archiver the backend calls when the log file passes the size limit.
 * The backend only ever keeps one archive of its own, so the whole rotation is done here: each archive moves one place down,
 * the oldest one falls off the end, and the file that just filled up becomes the newest archive. The log directory therefore
 * holds the current file plus at most `retainedArchiveCount` archives, which bounds it at that many times the size limit.
 * @param retainedArchiveCount How many archives to keep besides the current log file.
 * @returns The archiver to install on the file transport.
 */
const createArchiveLogFn = (retainedArchiveCount: number): (oldLogFile: unknown) => void => {
	return (oldLogFile) => {
		// The backend hands over its own file object, and describes itself as the path when asked for a string
		const filePath = String(oldLogFile);

		// A rotation that failed is ignored exactly like a write that failed: the log is a diagnostic trace and never a source
		// of truth, and there is nobody to report this to that could do anything about it
		try {
			// Keeping no archive at all still has to free the path, or the backend would reopen the file it just filled up
			if(retainedArchiveCount < 1) {
				rmSync(filePath, { force: true });

				return;
			}

			rmSync(createArchiveFilePath(filePath, retainedArchiveCount), { force: true });

			// Downwards, so that an archive is never renamed over one that has not been moved out of the way yet
			for(let archiveIndex = retainedArchiveCount - 1; archiveIndex >= 1; archiveIndex -= 1) {
				const archiveFilePath = createArchiveFilePath(filePath, archiveIndex);

				if(existsSync(archiveFilePath)) {
					renameSync(archiveFilePath, createArchiveFilePath(filePath, archiveIndex + 1));
				}
			}

			renameSync(filePath, createArchiveFilePath(filePath, 1));
		}
		catch {
			// Intentionally ignored
		}
	};
};

const configureLoggerBackend = (
	backend: AppLoggerBackend,
	configuration: AppLoggerConfiguration
): void => {
	if(backend.transports.console) {
		backend.transports.console.level = false;
	}
	if(backend.transports.ipc) {
		backend.transports.ipc.level = false;
	}
	if(backend.transports.remote) {
		backend.transports.remote.level = false;
	}

	backend.transports.file.level = 'debug';
	backend.transports.file.fileName = configuration.fileName;
	backend.transports.file.format = ({ data }) => {
		return [ String(data[0]) ];
	};
	backend.transports.file.maxSize = configuration.maximumFileSizeBytes;
	backend.transports.file.archiveLogFn = createArchiveLogFn(configuration.retainedArchiveCount);
	backend.transports.file.resolvePathFn = () => {
		return configuration.filePath;
	};
	backend.transports.file.sync = true;
};

const createLogEntry = (
	level: AppLogLevel,
	message: string,
	fields: AppLogFields | undefined,
	now: () => Date
): AppLogEntry => {
	return {
		createdAt: now().toISOString(),
		level,
		message,
		...fields
	};
};

const serializeLogEntry = (entry: AppLogEntry): string => {
	return JSON.stringify(entry);
};

const assertLogFileWritable = (logDirectory: string, filePath: string): void => {
	mkdirSync(logDirectory, { recursive: true });

	const fileDescriptor = openSync(filePath, 'a');
	closeSync(fileDescriptor);
};

const createStartupFailureMessage = (filePath: string, error: unknown): string => {
	return `${LOG_WRITE_FAILED_MESSAGE} Could not open "${filePath}" for appending. ${getErrorMessage(error)}`;
};

const getStartupFailureMessage = (logDirectory: string, filePath: string): string | undefined => {
	try {
		assertLogFileWritable(logDirectory, filePath);
		return undefined;
	}
	catch(error) {
		return createStartupFailureMessage(filePath, error);
	}
};

export const createAppLogger = ({
	logDirectory,
	fileName,
	maximumFileSizeBytes,
	retainedArchiveCount,
	backendFactory = createElectronLoggerBackend,
	now = () => {
		return new Date();
	}
}: CreateAppLoggerOptions): AppLogger => {
	const configuration: AppLoggerConfiguration = {
		filePath: path.join(logDirectory, fileName),
		fileName,
		maximumFileSizeBytes,
		retainedArchiveCount
	};
	const backend = backendFactory(createLogId(logDirectory));

	configureLoggerBackend(backend, configuration);
	const startupFailureMessage = getStartupFailureMessage(logDirectory, configuration.filePath);

	const getStatus = (): AppLoggerStatus => {
		if(startupFailureMessage) {
			return {
				state: 'unavailable',
				message: startupFailureMessage
			};
		}

		return {
			state: 'healthy'
		};
	};

	// The file transport writes synchronously, so a line is on disk once this returns and the entries describing a crash survive it.
	// The outcome is not checked: the log is a diagnostic trace, never a source of truth, and reading the file back to confirm every
	// line costs far more than writing it. A write that fails is therefore lost, which is what the operational log contract allows.
	// Serializing the entry can still throw, on a field JSON cannot represent, and that must never reach the caller.
	const write = (
		level: AppLogLevel,
		message: string,
		fields?: AppLogFields
	): void => {
		try {
			backend[level](serializeLogEntry(createLogEntry(level, message, fields, now)));
		}
		catch {
			// Intentionally ignored
		}
	};

	return {
		debug: (message, fields) => {
			write('debug', message, fields);
		},
		error: (message, fields) => {
			write('error', message, fields);
		},
		info: (message, fields) => {
			write('info', message, fields);
		},
		warn: (message, fields) => {
			write('warn', message, fields);
		},

		// Nothing is ever pending, because every entry is written before its call returns. The method stays part of the logger so that
		// shutdown keeps one place to wait on, and so that a buffering transport could be introduced without changing its callers.
		flush: () => {
			return Promise.resolve();
		},
		getStatus,
		getConfiguration: () => {
			return configuration;
		}
	};
};

export const initializeAppLogger = (options: CreateAppLoggerOptions): AppLogger => {
	activeAppLogger = createAppLogger(options);

	return activeAppLogger;
};

export const resetAppLoggerForTests = (): void => {
	activeAppLogger = createUninitializedAppLogger();
};
