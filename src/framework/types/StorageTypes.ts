/**
 * The contract between a database-backed main process and its renderer.
 * Commands and records are application concepts, so both stay generic: the framework only fixes the envelope every result is reported in.
 */

export type StorageDatabaseHealth = 'not-configured' | 'healthy' | 'unavailable';

export interface StorageDatabaseStatus {
	state: StorageDatabaseHealth;
	message?: string;
}

// The backup folder is a write-only destination for rotated copies, so a failing backup never means the records themselves are at risk
export type BackupHealth = 'idle' | 'ok' | 'failed';

// The folder holds two kinds of copy and they are reported separately: the one that is kept up to date says how recent the backup
// is, and the newest dated one says how far back the folder still reaches.
export interface BackupStatus {
	state: BackupHealth;
	directory: string;
	latestCopyAt?: string;
	latestCopyPath?: string;
	lastArchiveAt?: string;
	lastArchivePath?: string;
	message?: string;
}

export type BackupResult = {
	ok: true;
	backupPath: string;
	status: BackupStatus;
} | {
	ok: false;
	message: string;
	status: BackupStatus;
};

export interface StorageStatus {
	database: StorageDatabaseStatus;
	storageDirectory?: string;
	databasePath?: string;
	backup?: BackupStatus;
}

export type StorageFailureReason = 'not-implemented' | 'database-error' | 'invalid-command' | 'shutdown';

export interface StorageFailure {
	ok: false;
	reason: StorageFailureReason;
	message: string;
	status: StorageStatus;
}

export type LoadRecordsResult<TRecord> = {
	ok: true;
	records: TRecord[];
	status: StorageStatus;
} | StorageFailure;

export type StorageCommandResult = {
	ok: true;
	status: StorageStatus;
} | StorageFailure;

// An operational log line always carries a message, and the remaining fields are whatever the application wants to record alongside it
export interface OperationalLogEntry {
	message: string;
	[field: string]: unknown;
}

export type OperationalLogWriteResult = {
	ok: true;
	status: StorageStatus;
} | StorageFailure;
