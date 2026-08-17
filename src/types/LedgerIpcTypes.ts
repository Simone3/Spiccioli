import type { LedgerRefusal } from 'src/logic/ledger/LedgerRefusal';
import type { LedgerEntityKey } from 'src/types/LedgerTypes';
import type { Preferences, RecentLedgerFile } from 'src/types/PreferencesTypes';

/**
 * What crosses the bridge for storage.
 *
 * The split is the one the implementation plan fixes: **the main process owns the file and nothing else**, so everything here
 * carries text and paths, and never a parsed document. The renderer holds the model, reads it and writes it — which is what
 * keeps the reader and the writer pure and keeps the shape of a ledger out of the process that moves its bytes.
 *
 * The one thing that travels the other way is what only the renderer knows: the schema version it read, the record counts and
 * how long parsing took, sent back so that the main process can write them into the operational log.
 */

export type ChooseLedgerFileResult = {
	cancelled: true;
} | {
	cancelled: false;
	filePath: string;
};

export type ReadLedgerFileResult = {
	outcome: 'read';
	filePath: string;
	contents: string;
	sizeBytes: number;
} | {
	outcome: 'unreadable';
	filePath: string;

	// What the operating system said. Reported to the user and written to the log; it is about the file, never about its contents.
	message: string;
};

// Sent once the renderer has parsed and validated what it was handed, and what makes that file the open one
export interface AcceptLedgerFileRequest {
	filePath: string;
	schemaVersion: number;
	recordCounts: Record<LedgerEntityKey, number>;
	parseDurationMs: number;
}

export interface RejectLedgerFileRequest {
	filePath: string;
	refusal: LedgerRefusal;
}

export interface CreateLedgerFileRequest {
	filePath: string;
	contents: string;
	schemaVersion: number;
}

export type LedgerWriteResult = {
	ok: true;

	// Local time, as an ISO instant. The sidebar's "Saved 14:32" is this.
	savedAt: string;
} | {
	ok: false;
	filePath: string;

	// What the system said, after the last attempt
	message: string;
};

export interface LedgerBackupResult {
	written: boolean;
	backupFileName?: string;

	// How many copies the folder holds now, which is what the sentence about rotation interpolates
	retainedCount?: number;
	message?: string;
}

export interface UpgradeLedgerRequest {
	contents: string;
	fromSchemaVersion: number;
	toSchemaVersion: number;

	// The counts the dialog showed, written to the log with the upgrade
	transactionsRecategorised: number;
	rulesRepointed: number;
	rulesDeleted: number;
	categoriesRetired: number;
}

// However the open file stops being the open file, that is a close, and all four doors take the closing copy
export const LEDGER_CLOSE_DOORS = [ 'quit', 'window-closed', 'new-file', 'open-file' ] as const;

export type LedgerCloseDoor = typeof LEDGER_CLOSE_DOORS[number];

export interface CloseLedgerSessionRequest {
	door: LedgerCloseDoor;
}

export interface LedgerWriteAttemptFailedEvent {
	attempt: number;
	maximumAttempts: number;
	filePath: string;
	message: string;
}

export interface LedgerExternalModificationEvent {
	filePath: string;
	backup: LedgerBackupResult;
}

// What the File menu asks the renderer to do. The renderer drives it, because it is the side that has to finish saving first.
export type LedgerMenuCommand = {
	command: 'new-file';
} | {
	command: 'open-file';
} | {
	command: 'open-recent-file';
	filePath: string;
};

/**
 * What the preload publishes on "window.spiccioliLedger".
 * Every subscription returns the function that cancels it, so a component can clean up after itself.
 */
export interface SpiccioliLedgerApi {
	chooseFileToOpen: () => Promise<ChooseLedgerFileResult>;
	chooseFileToCreate: () => Promise<ChooseLedgerFileResult>;
	readFile: (filePath: string) => Promise<ReadLedgerFileResult>;
	acceptFile: (request: AcceptLedgerFileRequest) => Promise<void>;
	rejectFile: (request: RejectLedgerFileRequest) => Promise<void>;
	createFile: (request: CreateLedgerFileRequest) => Promise<LedgerWriteResult>;
	save: (contents: string) => Promise<LedgerWriteResult>;
	writePreUpgradeBackup: () => Promise<LedgerBackupResult>;
	completeUpgrade: (request: UpgradeLedgerRequest) => Promise<LedgerWriteResult>;
	closeSession: (request: CloseLedgerSessionRequest) => Promise<LedgerBackupResult>;

	// Where the open ledger's copies live. Derived from the ledger and never chosen, so the main process is what answers it.
	getBackupDirectory: () => Promise<string | undefined>;

	getRecentFiles: () => Promise<RecentLedgerFile[]>;
	dismissRecentFile: (filePath: string) => Promise<RecentLedgerFile[]>;
	getPreferences: () => Promise<Preferences>;
	setPreferences: (preferences: Preferences) => Promise<void>;
	onWriteAttemptFailed: (listener: (event: LedgerWriteAttemptFailedEvent) => void) => () => void;
	onExternalModification: (listener: (event: LedgerExternalModificationEvent) => void) => () => void;
	onMenuCommand: (listener: (command: LedgerMenuCommand) => void) => () => void;
	onPrepareForClose: (listener: (door: LedgerCloseDoor) => void) => () => void;
}

export interface RenderErrorReport {
	message: string;
	stack?: string;
	componentStack?: string;
}

export interface SpiccioliDiagnosticsApi {
	reportRenderError: (report: RenderErrorReport) => Promise<void>;
}
