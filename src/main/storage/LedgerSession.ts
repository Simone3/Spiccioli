import { LEDGER_FILE_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { writeBackupCopy } from 'src/framework/main/storage/FileBackupRotation';
import { createRetryingFileWriter, type RetryingFileWriter } from 'src/framework/main/storage/RetryingFileWriter';
import { readWholeFile } from 'src/framework/main/storage/WholeFileStorage';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import { resolveLedgerBackupNaming, resolveLedgerTemporaryFilePath, type LedgerBackupKind } from 'src/main/storage/LedgerBackupNaming';
import type { SpiccioliTranslator } from 'src/i18n/Translations';
import type {
	AcceptLedgerFileRequest,
	CreateLedgerFileRequest,
	LedgerBackupResult,
	LedgerCloseDoor,
	LedgerExternalModificationEvent,
	LedgerWriteAttemptFailedEvent,
	LedgerWriteResult,
	ReadLedgerFileResult,
	RejectLedgerFileRequest,
	UpgradeLedgerRequest
} from 'src/types/LedgerIpcTypes';

/**
 * The one open ledger, from the main process's side of the bridge.
 *
 * It owns the file and nothing else: it moves bytes through the framework's storage layer, it names the copies, and it writes
 * every entry the operational log's inventory asks of this phase. **It never parses a ledger.** The schema version, the record
 * counts and how long parsing took arrive from the renderer, which is the side that holds the model.
 *
 * The state it keeps is small and all of it is about the session rather than about the data: which file is open, what its bytes
 * last hashed to, and whether anything has been written since it was opened — which is what decides whether the close takes a
 * copy.
 */

export interface CreateLedgerSessionOptions {
	translator: SpiccioliTranslator;

	// Read when a copy is written, so that changing the preference takes effect on the next copy rather than on the next run
	readBackupCount: () => number;

	rememberRecentFile: (filePath: string) => void;
	onWriteAttemptFailed: (event: LedgerWriteAttemptFailedEvent) => void;
	onExternalModification: (event: LedgerExternalModificationEvent) => void;
	now?: () => Date;

	// How the spacing between two write attempts is waited out. Injected by the tests, which cannot sit through four of them.
	delay?: (durationMs: number) => Promise<void>;
}

export interface LedgerSession {
	getOpenFilePath: () => string | undefined;

	// Where the open ledger's copies live, which Settings states as a read-only fact about the session
	getBackupDirectory: () => string | undefined;

	readFile: (filePath: string) => Promise<ReadLedgerFileResult>;
	acceptFile: (request: AcceptLedgerFileRequest) => void;
	rejectFile: (request: RejectLedgerFileRequest) => void;
	createFile: (request: CreateLedgerFileRequest) => Promise<LedgerWriteResult>;
	save: (contents: string) => Promise<LedgerWriteResult>;
	writePreUpgradeBackup: () => Promise<LedgerBackupResult>;
	completeUpgrade: (request: UpgradeLedgerRequest) => Promise<LedgerWriteResult>;
	closeSession: (door: LedgerCloseDoor) => Promise<LedgerBackupResult>;
}

// What "readFile" is holding until the renderer says whether it could read it. A file is not the open one until it has been parsed.
interface PendingLedgerFile {
	filePath: string;
	contents: string;
	hash: string;
}

export const createLedgerSession = ({
	translator,
	readBackupCount,
	rememberRecentFile,
	onWriteAttemptFailed,
	onExternalModification,
	now = () => {
		return new Date();
	},
	delay
}: CreateLedgerSessionOptions): LedgerSession => {
	let openFilePath: string | undefined;
	let writer: RetryingFileWriter | undefined;
	let pendingFile: PendingLedgerFile | undefined;

	// A session that only read the file writes no copy on close, whichever door it leaves by
	let hasWrittenDuringSession = false;

	/**
	 * Writes one copy into the ledger's own backup folder and rotates the oldest out.
	 * A copy that cannot be written never stops the session and is never silent: it comes back as a failure with the reason,
	 * and every caller has somewhere to say it.
	 * @param filePath The ledger the copy belongs to, which is what the folder and the name are derived from.
	 * @param kind Which of the three moments produced this copy.
	 * @param contents The bytes to copy.
	 * @returns Where the copy landed and how many the folder holds, or why it could not be written.
	 */
	const writeCopy = async(filePath: string, kind: LedgerBackupKind, contents: string): Promise<LedgerBackupResult> => {
		const naming = resolveLedgerBackupNaming(filePath);
		const backupFileName = naming.createBackupFileName(kind, now());

		try {
			const result = await writeBackupCopy({
				backupDirectory: naming.backupDirectory,
				backupFileName,
				contents,
				retainedCount: readBackupCount(),
				isBackupFileName: naming.isBackupFileName,
				temporaryFileSuffix: LEDGER_FILE_CONFIG.temporaryFileSuffix
			});

			appLogger.info('Ledger backup copy written', {
				type: 'storage.backup',
				kind,
				backupDirectory: naming.backupDirectory,
				backupFileName,
				retainedCount: result.retainedCount,
				rotatedOutFileNames: result.rotatedOutFileNames
			});

			return {
				written: true,
				backupFileName,
				retainedCount: result.retainedCount
			};
		}
		catch(error) {
			const message = getErrorMessage(error);

			appLogger.error('Could not write the ledger backup copy', {
				type: 'storage.backup',
				kind,
				backupDirectory: naming.backupDirectory,
				backupFileName,
				error: message
			});

			return {
				written: false,
				message
			};
		}
	};

	// Something else wrote the file while this session had it open. The version found on disk is copied into the backup folder
	// and the session carries on in memory, whose next save overwrites it.
	const handleExternalModification = async(filePath: string, displacedContents: string | undefined, recordedHash: string, foundHash: string | undefined): Promise<void> => {
		const backup = displacedContents === undefined ?
			{ written: false } :
			await writeCopy(filePath, 'external', displacedContents);

		appLogger.warn('The ledger file was modified outside Spiccioli', {
			type: 'storage.external',
			filePath,
			recordedHash,
			foundHash,
			backupFileName: backup.backupFileName,
			backupWritten: backup.written
		});

		onExternalModification({ filePath, backup });
	};

	const createWriter = (filePath: string): RetryingFileWriter => {
		return createRetryingFileWriter({
			filePath,
			temporaryFilePath: resolveLedgerTemporaryFilePath(filePath),
			maximumAttempts: STORAGE_CONFIG.maximumWriteAttempts,
			retryDelayMs: STORAGE_CONFIG.writeRetryDelayMs,
			writeTimeoutMs: STORAGE_CONFIG.writeTimeoutMs,
			writeTimeoutMessage: translator.t('storage.writeTimedOut', { seconds: STORAGE_CONFIG.writeTimeoutMs / 1000 }),
			onAttemptFailed: ({ attempt, message, nextAttemptInMs }) => {
				if(nextAttemptInMs === undefined) {
					appLogger.error('The ledger file could not be written', {
						type: 'storage.save',
						filePath,
						attempt,
						maximumAttempts: STORAGE_CONFIG.maximumWriteAttempts,
						error: message
					});
				}
				else {
					appLogger.warn('A ledger write failed and will be retried', {
						type: 'storage.save',
						filePath,
						attempt,
						maximumAttempts: STORAGE_CONFIG.maximumWriteAttempts,
						nextAttemptInMs,
						error: message
					});
				}

				onWriteAttemptFailed({
					attempt,
					maximumAttempts: STORAGE_CONFIG.maximumWriteAttempts,
					filePath,
					message
				});
			},
			onExternalModification: ({ displacedContents, recordedHash, foundHash }) => {
				return handleExternalModification(filePath, displacedContents, recordedHash, foundHash);
			},
			delay
		});
	};

	// Every path that puts bytes on disk comes through here, so that a write that took more than one attempt says so in the log
	// and a session is marked as having changed exactly when it has
	const writeThrough = async(filePath: string, contents: string): Promise<LedgerWriteResult> => {
		if(!writer) {
			writer = createWriter(filePath);
		}

		const outcome = await writer.write(contents);

		if(!outcome.ok) {
			return {
				ok: false,
				filePath,
				message: outcome.message
			};
		}

		hasWrittenDuringSession = true;

		if(outcome.attempts > 1) {
			appLogger.info('A retried ledger write succeeded', {
				type: 'storage.save',
				filePath,
				attempt: outcome.attempts
			});
		}

		appLogger.debug('Ledger saved', {
			type: 'storage.save',
			filePath,
			sizeBytes: outcome.result.sizeBytes,
			writeDurationMs: outcome.result.writeDurationMs,
			renameDurationMs: outcome.result.renameDurationMs
		});

		return {
			ok: true,
			savedAt: now().toISOString()
		};
	};

	const readFile = async(filePath: string): Promise<ReadLedgerFileResult> => {
		try {
			const file = await readWholeFile(filePath);

			pendingFile = { filePath, contents: file.contents, hash: file.hash };

			return {
				outcome: 'read',
				filePath,
				contents: file.contents,
				sizeBytes: file.sizeBytes
			};
		}
		catch(error) {
			const message = getErrorMessage(error);

			pendingFile = undefined;

			appLogger.warn('A ledger file could not be read', {
				type: 'ledger.refused',
				filePath,
				reason: 'unreadable',
				error: message
			});

			return {
				outcome: 'unreadable',
				filePath,
				message
			};
		}
	};

	// The file that was read becomes the open one, with its hash recorded so that the first save can tell whether anything else
	// has touched it since
	const openPendingFile = (filePath: string): void => {
		openFilePath = filePath;
		writer = createWriter(filePath);

		if(pendingFile?.filePath === filePath) {
			writer.recordHash(pendingFile.hash);
		}

		hasWrittenDuringSession = false;
		rememberRecentFile(filePath);
	};

	const acceptFile = ({ filePath, schemaVersion, recordCounts, parseDurationMs }: AcceptLedgerFileRequest): void => {
		openPendingFile(filePath);
		pendingFile = undefined;

		appLogger.info('Ledger opened', {
			type: 'ledger.open',
			filePath,
			schemaVersion,
			recordCounts,
			parseDurationMs
		});
	};

	const rejectFile = ({ filePath, refusal }: RejectLedgerFileRequest): void => {
		pendingFile = undefined;

		appLogger.warn('A ledger file was refused', {
			type: 'ledger.refused',
			filePath,
			...refusal
		});
	};

	const createFile = async({ filePath, contents, schemaVersion }: CreateLedgerFileRequest): Promise<LedgerWriteResult> => {
		openFilePath = filePath;
		writer = createWriter(filePath);
		pendingFile = undefined;

		const result = await writeThrough(filePath, contents);

		if(!result.ok) {
			openFilePath = undefined;
			writer = undefined;

			return result;
		}

		// A file that was only just written holds nothing a copy of it would preserve, so the session starts clean and the
		// close takes a copy only once something has actually been recorded in it
		hasWrittenDuringSession = false;
		rememberRecentFile(filePath);

		appLogger.info('Ledger created', {
			type: 'ledger.created',
			filePath,
			schemaVersion
		});

		return result;
	};

	const save = (contents: string): Promise<LedgerWriteResult> => {
		if(!openFilePath) {
			return Promise.resolve({
				ok: false,
				filePath: '',
				message: translator.t('storage.noFileOpen')
			});
		}

		return writeThrough(openFilePath, contents);
	};

	const writePreUpgradeBackup = async(): Promise<LedgerBackupResult> => {
		if(!pendingFile) {
			return {
				written: false,
				message: translator.t('storage.noFileOpen')
			};
		}

		return writeCopy(pendingFile.filePath, 'pre-upgrade', pendingFile.contents);
	};

	const completeUpgrade = async(request: UpgradeLedgerRequest): Promise<LedgerWriteResult> => {
		const upgraded = pendingFile;

		if(!upgraded) {
			return {
				ok: false,
				filePath: '',
				message: translator.t('storage.noFileOpen')
			};
		}

		openPendingFile(upgraded.filePath);
		pendingFile = undefined;

		const result = await writeThrough(upgraded.filePath, request.contents);

		if(!result.ok) {
			return result;
		}

		appLogger.info('Ledger upgraded', {
			type: 'ledger.upgraded',
			filePath: upgraded.filePath,
			fromSchemaVersion: request.fromSchemaVersion,
			toSchemaVersion: request.toSchemaVersion,
			transactionsRecategorised: request.transactionsRecategorised,
			rulesRepointed: request.rulesRepointed,
			rulesDeleted: request.rulesDeleted,
			categoriesRetired: request.categoriesRetired
		});

		return result;
	};

	// However the open file stops being the open file, that is a close: quit, the window closing, and leaving this file for a
	// new one or another one all arrive here
	const closeSession = async(door: LedgerCloseDoor): Promise<LedgerBackupResult> => {
		const filePath = openFilePath;
		const changed = hasWrittenDuringSession;

		openFilePath = undefined;
		writer = undefined;
		pendingFile = undefined;
		hasWrittenDuringSession = false;

		if(!filePath) {
			return { written: false };
		}

		let backup: LedgerBackupResult = { written: false };

		if(changed) {
			try {
				backup = await writeCopy(filePath, 'close', (await readWholeFile(filePath)).contents);
			}
			catch(error) {
				backup = {
					written: false,
					message: getErrorMessage(error)
				};
			}
		}

		appLogger.info('Ledger session closed', {
			type: 'ledger.closed',
			filePath,
			door,
			changed,
			backupWritten: backup.written
		});

		return backup;
	};

	return {
		getOpenFilePath: () => {
			return openFilePath;
		},
		getBackupDirectory: () => {
			return openFilePath === undefined ? undefined : resolveLedgerBackupNaming(openFilePath).backupDirectory;
		},
		readFile,
		acceptFile,
		rejectFile,
		createFile,
		save,
		writePreUpgradeBackup,
		completeUpgrade,
		closeSession
	};
};
