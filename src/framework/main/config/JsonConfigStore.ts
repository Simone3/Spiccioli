import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

	const write = (config: TConfig): void => {
		try {
			mkdirSync(path.dirname(filePath), { recursive: true });
			writeFileSync(filePath, `${JSON.stringify(config, undefined, '\t')}\n`, 'utf8');
		}
		catch(error) {
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
