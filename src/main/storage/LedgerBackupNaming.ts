import path from 'node:path';
import { LEDGER_FILE_CONFIG } from 'src/config/AppConfig';

/**
 * Where a ledger's copies live and what they are called.
 *
 * **The folder is derived from the ledger, never chosen.** A ledger at ".../ledgers/finances.spiccioli" keeps its copies in
 * ".../ledgers/finances-backups/" — the file's own name without its extension, plus "-backups", in the same directory. The
 * rotation is therefore per file: a second ledger in the same directory keeps its own count in its own folder, and neither
 * pushes the other out.
 *
 * **A copy is named for the file, the moment and what took it**, and carries the ledger's own extension. The time runs to the
 * millisecond, and that is the whole of the reason: two closes inside one minute is ordinary work rather than an edge case, and
 * a name to the second would eventually have had one copy overwrite another. The folder still sorts chronologically by name,
 * which is what lets the rotation find the oldest by sorting.
 */

export type LedgerBackupKind = 'close' | 'external' | 'pre-upgrade';

export interface LedgerBackupNaming {
	backupDirectory: string;
	createBackupFileName: (kind: LedgerBackupKind, at: Date) => string;

	// Which files in the folder are this ledger's copies. Anything else there is not this rotation's to remove.
	isBackupFileName: (fileName: string) => boolean;
}

const BACKUP_SUFFIXES: Record<LedgerBackupKind, string> = {
	close: LEDGER_FILE_CONFIG.closeBackupSuffix,
	external: LEDGER_FILE_CONFIG.externalBackupSuffix,
	'pre-upgrade': LEDGER_FILE_CONFIG.preUpgradeBackupSuffix
};

const escapeForRegExp = (value: string): string => {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const padded = (value: number, length: number): string => {
	return String(value).padStart(length, '0');
};

// Local time, because the name is read by whoever opens the folder and they are in it
const formatBackupTimestamp = (at: Date): string => {
	const day = `${at.getFullYear()}-${padded(at.getMonth() + 1, 2)}-${padded(at.getDate(), 2)}`;
	const time = `${padded(at.getHours(), 2)}${padded(at.getMinutes(), 2)}${padded(at.getSeconds(), 2)}`;

	return `${day}-${time}-${padded(at.getMilliseconds(), 3)}`;
};

/**
 * Works out a ledger's backup folder and the names of the copies that go in it.
 * @param ledgerFilePath The ledger.
 * @returns Where its copies live, how one is named, and how to recognise one.
 */
export const resolveLedgerBackupNaming = (ledgerFilePath: string): LedgerBackupNaming => {
	const directory = path.dirname(ledgerFilePath);
	const extension = path.extname(ledgerFilePath);
	const baseName = path.basename(ledgerFilePath, extension);
	const suffixPattern = Object.values(BACKUP_SUFFIXES).filter((suffix) => {
		return suffix !== '';
	}).map(escapeForRegExp).join('|');
	const backupFileNamePattern = new RegExp(`^${escapeForRegExp(baseName)}-\\d{4}-\\d{2}-\\d{2}-\\d{6}-\\d{3}(?:${suffixPattern})?${escapeForRegExp(extension)}$`);

	return {
		backupDirectory: path.join(directory, `${baseName}${LEDGER_FILE_CONFIG.backupDirectorySuffix}`),
		createBackupFileName: (kind, at) => {
			return `${baseName}-${formatBackupTimestamp(at)}${BACKUP_SUFFIXES[kind]}${extension}`;
		},
		isBackupFileName: (fileName) => {
			return backupFileNamePattern.test(fileName);
		}
	};
};

/**
 * Works out where a ledger's atomic write puts its temporary file, which has to be in the ledger's own directory.
 * @param ledgerFilePath The ledger.
 * @returns The temporary file's path.
 */
export const resolveLedgerTemporaryFilePath = (ledgerFilePath: string): string => {
	return `${ledgerFilePath}${LEDGER_FILE_CONFIG.temporaryFileSuffix}`;
};
