import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { appLogger } from 'src/framework/main/logging/AppLogger';

export interface JsonConfigStore<TConfig> {
	read: () => TConfig;
	write: (config: TConfig) => void;
}

export interface CreateJsonConfigStoreOptions<TConfig> {
	filePath: string;

	// Turns whatever was parsed out of the file into a configuration. It is called with "undefined" when the file is missing or unreadable, so it also decides what an empty configuration looks like.
	parse: (content: unknown) => TConfig;
}

// A missing or unreadable configuration file is treated as an empty configuration, so a corrupted file behaves like a first startup instead of blocking the app
export const createJsonConfigStore = <TConfig>({ filePath, parse }: CreateJsonConfigStoreOptions<TConfig>): JsonConfigStore<TConfig> => {
	const read = (): TConfig => {
		try {
			return parse(JSON.parse(readFileSync(filePath, 'utf8')));
		}
		catch {
			return parse(undefined);
		}
	};

	/**
	 * Writes the configuration whole and atomically: to a temporary file beside it, then renamed onto it.
	 *
	 * A truncating write can be interrupted, and what it leaves behind is a file that parses as nothing — which this store
	 * quite correctly reads as a first startup, and every preference the user ever set is gone. A rename inside one directory
	 * cannot be interrupted that way, so what is there is either the old configuration or the new one.
	 *
	 * The temporary file carries the process id so that two runs writing their own preferences cannot fill one another's.
	 * @param config What to store.
	 */
	const write = (config: TConfig): void => {
		const temporaryFilePath = `${filePath}.${process.pid}.tmp`;

		try {
			mkdirSync(path.dirname(filePath), { recursive: true });
			writeFileSync(temporaryFilePath, `${JSON.stringify(config, undefined, '\t')}\n`, 'utf8');
			renameSync(temporaryFilePath, filePath);
		}
		catch(error) {
			// Best effort, and never at the cost of reporting the write itself: what is being cleaned up is a file that may
			// never have been created, and a failure to remove it is not the failure worth telling anybody about
			try {
				rmSync(temporaryFilePath, { force: true, recursive: true });
			}
			catch {
				// Left where it is
			}

			appLogger.error('Could not write the configuration file', {
				type: 'config.write',
				configFilePath: filePath,
				error: String(error)
			});
		}
	};

	return {
		read,
		write
	};
};
