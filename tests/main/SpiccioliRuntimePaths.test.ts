import path from 'node:path';
import type { App } from 'electron';
import { APP_CONFIG_FILE, LOGGING_CONFIG } from 'src/config/AppConfig';
import { resolveSpiccioliRuntimePaths } from 'src/main/config/SpiccioliRuntimePaths';

const userDataPath = path.join('/tmp', 'spiccioli-user-data');

const createMockApp = (isPackaged: boolean): Pick<App, 'getPath' | 'isPackaged'> => {
	return {
		getPath: vi.fn(() => {
			return userDataPath;
		}),
		isPackaged
	} as unknown as Pick<App, 'getPath' | 'isPackaged'>;
};

describe('SpiccioliRuntimePaths', () => {
	test('resolves packaged paths inside the Electron user-data folder', () => {
		const app = createMockApp(true);

		expect(resolveSpiccioliRuntimePaths(app)).toEqual({
			isDevelopment: false,
			rootDirectory: userDataPath,
			configFilePath: path.join(userDataPath, APP_CONFIG_FILE.fileName),
			logDirectory: path.join(userDataPath, LOGGING_CONFIG.directoryName)
		});
		expect(app.getPath).toHaveBeenCalledWith('userData');
	});

	test('keeps development paths in a separate development folder', () => {
		const developmentPath = path.join(userDataPath, APP_CONFIG_FILE.developmentDirectoryName);

		expect(resolveSpiccioliRuntimePaths(createMockApp(false))).toEqual({
			isDevelopment: true,
			rootDirectory: developmentPath,
			configFilePath: path.join(developmentPath, APP_CONFIG_FILE.fileName),
			logDirectory: path.join(developmentPath, LOGGING_CONFIG.directoryName)
		});
	});
});
