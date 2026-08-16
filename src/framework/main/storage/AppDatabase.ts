import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';

export type SqlParameter = SQLInputValue;

export interface DatabaseRunResult {
	changes: number | bigint;
	lastInsertRowid: number | bigint;
}

export interface AppDatabase {
	databasePath: string;
	close: () => void;
	execQuery: (query: string) => void;
	runQuery: (query: string, ...parameters: SqlParameter[]) => DatabaseRunResult;
	getQuery: <TRow>(query: string, ...parameters: SqlParameter[]) => TRow | undefined;
	getAllQueryRows: <TRow>(query: string, ...parameters: SqlParameter[]) => TRow[];
	runTransaction: (callback: () => void) => void;
	vacuumInto: (targetPath: string) => void;
	getAppliedMigrationVersions: () => number[];
}

// One schema step. Migrations are applied in ascending version order, each inside its own transaction, and every version is applied at most once.
export interface DatabaseMigration {
	version: number;
	apply: (database: AppDatabase) => void;
}

export interface OpenAppDatabaseOptions {
	storageDirectory: string;
	databaseFileName: string;
	migrations: readonly DatabaseMigration[];
	timeoutMs: number;
	now?: () => Date;
}

interface SqlQueryLogRecord {
	query: string;
	durationMs: number;
	result: 'success' | 'failure';
	error?: string;
}

interface MigrationRow {
	version: number;
}

interface SQLiteModule {
	DatabaseSync: typeof DatabaseSync;
}

const getSQLiteModule = (): SQLiteModule => {
	const sqliteModule = process.getBuiltinModule('node:sqlite') as SQLiteModule | undefined;

	if(!sqliteModule) {
		throw new Error('The current Node runtime does not provide node:sqlite.');
	}

	return sqliteModule;
};

const normalizeSqlQuery = (query: string): string => {
	return query.trim().replace(/\s+/g, ' ');
};

const writeSqlQueryLogRecord = (record: SqlQueryLogRecord): void => {
	appLogger[record.result === 'failure' ? 'error' : 'info']('Storage SQL query completed', {
		type: 'sql.query',
		query: record.query,
		elapsedMillis: Math.round(record.durationMs),
		result: record.result,
		error: record.error
	});
};

const logQuery = <T>(query: string, callback: () => T): T => {
	const startedAt = performance.now();

	try {
		const result = callback();

		writeSqlQueryLogRecord({
			query: normalizeSqlQuery(query),
			durationMs: performance.now() - startedAt,
			result: 'success'
		});

		return result;
	}
	catch(error) {
		writeSqlQueryLogRecord({
			query: normalizeSqlQuery(query),
			durationMs: performance.now() - startedAt,
			result: 'failure',
			error: getErrorMessage(error)
		});

		throw error;
	}
};

const createAppDatabaseWrapper = (
	connection: DatabaseSync,
	databasePath: string
): AppDatabase => {
	const execQuery = (query: string): void => {
		logQuery(query, () => {
			connection.exec(query);
		});
	};

	const runQuery = (query: string, ...parameters: SqlParameter[]): DatabaseRunResult => {
		return logQuery(query, () => {
			return connection.prepare(query).run(...parameters);
		});
	};

	const getQuery = <TRow>(query: string, ...parameters: SqlParameter[]): TRow | undefined => {
		return logQuery(query, () => {
			return connection.prepare(query).get(...parameters) as unknown as TRow | undefined;
		});
	};

	const getAllQueryRows = <TRow>(query: string, ...parameters: SqlParameter[]): TRow[] => {
		return logQuery(query, () => {
			return connection.prepare(query).all(...parameters) as unknown as TRow[];
		});
	};

	// Takes the write lock upfront, so a concurrent writer cannot make this transaction fail with an unrecoverable SQLITE_BUSY while upgrading from a read to a write
	const runTransaction = (callback: () => void): void => {
		execQuery('BEGIN IMMEDIATE');

		try {
			callback();
			execQuery('COMMIT');
		}
		catch(error) {
			// A failed rollback is already logged by the query logger, and it must not replace the error that actually broke the transaction, otherwise callers classify the wrong exception
			try {
				execQuery('ROLLBACK');
			}
			catch {
				// Intentionally ignored
			}

			throw error;
		}
	};

	// Writes a self-contained copy of the database, so a backup never has to reassemble the live file with its write-ahead log.
	// It opens its own read transaction, which is why it must not run while another transaction is open on this connection.
	const vacuumInto = (targetPath: string): void => {
		runQuery('VACUUM INTO ?', targetPath);
	};

	const getAppliedMigrationVersions = (): number[] => {
		const query = `
			SELECT version
			FROM schema_migrations
			ORDER BY version ASC
		`;

		return getAllQueryRows<MigrationRow>(query).map((row) => {
			return row.version;
		});
	};

	return {
		databasePath,
		close: () => {
			connection.close();
		},
		execQuery,
		runQuery,
		getQuery,
		getAllQueryRows,
		runTransaction,
		vacuumInto,
		getAppliedMigrationVersions
	};
};

const createSchemaMigrationsTable = (database: AppDatabase): void => {
	const query = `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`;

	database.execQuery(query);
};

const applyMigration = (database: AppDatabase, migration: DatabaseMigration, appliedAt: Date): void => {
	database.runTransaction(() => {
		const insertMigrationQuery = `
			INSERT INTO schema_migrations (version, applied_at)
			VALUES (?, ?)
		`;

		migration.apply(database);
		database.runQuery(insertMigrationQuery, migration.version, appliedAt.toISOString());
	});
};

// A database written by a newer version of the application may hold columns and constraints this one does not know about, so it is refused instead of being written to
const migrateDatabase = (database: AppDatabase, migrations: readonly DatabaseMigration[], now: () => Date): void => {
	createSchemaMigrationsTable(database);

	const appliedVersions = database.getAppliedMigrationVersions();
	const latestVersion = migrations.reduce((highestVersion, migration) => {
		return Math.max(highestVersion, migration.version);
	}, 0);
	const futureVersion = appliedVersions.find((version) => {
		return version > latestVersion;
	});
	if(futureVersion !== undefined) {
		throw new Error(`Unsupported database schema version ${futureVersion}.`);
	}

	migrations
		.filter((migration) => {
			return !appliedVersions.includes(migration.version);
		})
		.sort((first, second) => {
			return first.version - second.version;
		})
		.forEach((migration) => {
			applyMigration(database, migration, now());
		});
};

export const openAppDatabase = ({ storageDirectory, databaseFileName, migrations, timeoutMs, now = () => {
	return new Date();
} }: OpenAppDatabaseOptions): AppDatabase => {
	mkdirSync(storageDirectory, { recursive: true });

	const databasePath = path.join(storageDirectory, databaseFileName);
	const { DatabaseSync: DatabaseSyncConstructor } = getSQLiteModule();
	const connection = new DatabaseSyncConstructor(databasePath, {
		enableForeignKeyConstraints: true,
		allowExtension: false,
		timeout: timeoutMs
	});
	const database = createAppDatabaseWrapper(connection, databasePath);

	try {
		// The database always lives on the local user-data disk, never in a synchronized folder, so the write-ahead log and its shared-memory file are safe to use
		database.execQuery('PRAGMA journal_mode = WAL');
		migrateDatabase(database, migrations, now);
	}
	catch(error) {
		database.close();
		throw error;
	}

	return database;
};
