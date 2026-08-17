import { existsSync } from 'node:fs';
import { RECENT_FILES_CONFIG } from 'src/config/AppConfig';
import { createJsonConfigStore } from 'src/framework/main/config/JsonConfigStore';
import { parsePreferences } from 'src/logic/preferences/Preferences';
import type { Preferences, RecentLedgerFile, SpiccioliConfig } from 'src/types/PreferencesTypes';

/**
 * The preferences and the list of recently opened files, which belong to the installation rather than to any one ledger.
 *
 * Both live in the application-data file the runtime paths resolve, through the framework's configuration store — so a file
 * that is missing or corrupted reads as a first startup rather than blocking the application, and every value comes back at its
 * default.
 *
 * **The recent list is where the ledger paths live in plain text**, which is why a path is not redacted anywhere else either:
 * no storage failure can be diagnosed without knowing which file it was about.
 */

export interface SpiccioliConfigStore {
	readPreferences: () => Preferences;
	writePreferences: (preferences: Preferences) => void;

	// The list as the launch screen shows it: most recent first, each entry saying whether its file is still there
	readRecentFiles: () => RecentLedgerFile[];
	rememberRecentFile: (filePath: string) => void;

	// A recent entry whose file has moved stays in the list until it is dismissed, and this is the dismissal
	dismissRecentFile: (filePath: string) => RecentLedgerFile[];
}

export interface CreateSpiccioliConfigStoreOptions {
	configFilePath: string;
	fileExists?: (filePath: string) => boolean;
	now?: () => Date;
}

const parseRecentFiles = (value: unknown): SpiccioliConfig['recentFiles'] => {
	if(!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((entry) => {
		if(typeof entry !== 'object' || entry === null) {
			return [];
		}

		const { filePath, lastOpenedAt } = entry as Record<string, unknown>;

		if(typeof filePath !== 'string' || !filePath || typeof lastOpenedAt !== 'string') {
			return [];
		}

		return [ { filePath, lastOpenedAt } ];
	}).slice(0, RECENT_FILES_CONFIG.maximumEntries);
};

const parseConfig = (content: unknown): SpiccioliConfig => {
	const record = typeof content === 'object' && content !== null ? content as Record<string, unknown> : {};

	return {
		preferences: parsePreferences(record.preferences),
		recentFiles: parseRecentFiles(record.recentFiles)
	};
};

export const createSpiccioliConfigStore = ({
	configFilePath,
	fileExists = existsSync,
	now = () => {
		return new Date();
	}
}: CreateSpiccioliConfigStoreOptions): SpiccioliConfigStore => {
	const store = createJsonConfigStore<SpiccioliConfig>({
		filePath: configFilePath,
		parse: parseConfig
	});

	const decorateRecentFiles = (recentFiles: SpiccioliConfig['recentFiles']): RecentLedgerFile[] => {
		return recentFiles.map((recentFile) => {
			return {
				...recentFile,
				missing: !fileExists(recentFile.filePath)
			};
		});
	};

	return {
		readPreferences: () => {
			return store.read().preferences;
		},
		writePreferences: (preferences) => {
			store.write({
				...store.read(),
				preferences
			});
		},
		readRecentFiles: () => {
			return decorateRecentFiles(store.read().recentFiles);
		},
		rememberRecentFile: (filePath) => {
			const config = store.read();

			// One entry per file, most recent first: opening a file again moves it to the top rather than adding a second row
			const recentFiles = [
				{ filePath, lastOpenedAt: now().toISOString() },
				...config.recentFiles.filter((recentFile) => {
					return recentFile.filePath !== filePath;
				})
			].slice(0, RECENT_FILES_CONFIG.maximumEntries);

			store.write({ ...config, recentFiles });
		},
		dismissRecentFile: (filePath) => {
			const config = store.read();
			const recentFiles = config.recentFiles.filter((recentFile) => {
				return recentFile.filePath !== filePath;
			});

			store.write({ ...config, recentFiles });

			return decorateRecentFiles(recentFiles);
		}
	};
};
