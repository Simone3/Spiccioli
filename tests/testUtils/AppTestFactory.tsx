import { render, screen, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { ReactElement, ReactNode } from 'react';
import { makeSeededDocument } from './LedgerTestFactory';
import { SpiccioliApp } from 'src/components/SpiccioliApp';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import type { LedgerDocument } from 'src/types/LedgerTypes';
import { ChecksProvider } from 'src/contexts/ChecksContext';
import { LedgerProvider } from 'src/contexts/LedgerContext';
import { PreferencesProvider } from 'src/contexts/PreferencesContext';
import { ScreenMemoryProvider } from 'src/contexts/ScreenMemoryContext';
import { UnsavedDraftProvider } from 'src/contexts/UnsavedDraftContext';
import { TranslationProvider } from 'src/i18n/TranslationContext';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';
import type { SpiccioliAppMenuApi } from 'src/types/AppMenuTypes';
import type { SpiccioliDiagnosticsApi, SpiccioliLedgerApi } from 'src/types/LedgerIpcTypes';
import type { SpiccioliPricesApi } from 'src/types/PriceIpcTypes';

/**
 * The application as a test sees it: the preload bridge stubbed, and the providers the real root puts above every screen.
 * The router is a memory one rather than the hash one the application installs, which is the one difference and is what lets a
 * test start on a screen without a URL.
 */

const noop = (): void => {
	return undefined;
};

const unsubscribe = (): () => void => {
	return noop;
};

const SAVED_AT = new Date(2026, 7, 8, 14, 32).toISOString();

/**
 * The one bridge that reaches the network, stubbed. A test that says nothing about it gets a pass that asked for nothing.
 * @param overrides What this test needs the pass to answer.
 * @returns The bridge that was put on the window.
 */
export const stubPricesBridge = (overrides: Partial<SpiccioliPricesApi> = {}): SpiccioliPricesApi => {
	const bridge: SpiccioliPricesApi = {
		updatePrices: () => {
			return Promise.resolve({ referenceDate: null, outcomes: [] });
		},
		cancelPricePass: () => {
			return Promise.resolve();
		},
		reportPricesWritten: () => {
			return Promise.resolve();
		},

		// Nothing is pushed at a test that did not ask to be told, and removing the listener is what the screen calls either way
		onPassProgress: () => {
			return () => {
				// Nothing was listening
			};
		},
		...overrides
	};

	Object.defineProperty(window, 'spiccioliPrices', { configurable: true, value: bridge });

	return bridge;
};

export const TEST_LOG_DIRECTORY = '/Documents/Spiccioli/logs';

/**
 * What the build says about itself, stubbed. Settings is what reads it, for the folder the log is kept in.
 * @param overrides What this test needs the bridge to answer.
 * @returns The bridge that was put on the window.
 */
export const stubAppInfoBridge = (overrides: Partial<SpiccioliAppInfoApi> = {}): SpiccioliAppInfoApi => {
	const bridge: SpiccioliAppInfoApi = {
		getAppInfo: () => {
			return Promise.resolve({ version: '0.1.0', platform: 'darwin', logDirectory: TEST_LOG_DIRECTORY });
		},
		...overrides
	};

	Object.defineProperty(window, 'spiccioliAppInfo', { configurable: true, value: bridge });

	return bridge;
};

/**
 * The menu bar the renderer draws, stubbed. A test that says nothing about it gets what every platform with a native menu bar
 * gets: no menu at all, and therefore no drawn title bar.
 * @param overrides What this test needs the bridge to answer.
 * @returns The bridge that was put on the window.
 */
export const stubAppMenuBridge = (overrides: Partial<SpiccioliAppMenuApi> = {}): SpiccioliAppMenuApi => {
	const bridge: SpiccioliAppMenuApi = {
		getMenuBar: () => {
			return Promise.resolve([]);
		},
		runMenuCommand: () => {
			return Promise.resolve();
		},
		onMenuBarChanged: unsubscribe,
		...overrides
	};

	Object.defineProperty(window, 'spiccioliAppMenu', { configurable: true, value: bridge });

	return bridge;
};

/**
 * Everything the bridge publishes, stubbed. Only what a test cares about is overridden.
 * @param overrides What this test needs the bridge to answer.
 * @returns The bridge that was put on the window.
 */
export const stubLedgerBridge = (overrides: Partial<SpiccioliLedgerApi> = {}): SpiccioliLedgerApi => {
	const bridge: SpiccioliLedgerApi = {
		chooseFileToOpen: () => {
			return Promise.resolve({ cancelled: true });
		},
		chooseFileToCreate: () => {
			return Promise.resolve({ cancelled: true });
		},
		readFile: () => {
			return Promise.resolve({ outcome: 'unreadable', filePath: '/missing.spiccioli', message: 'No such file' });
		},
		acceptFile: () => {
			return Promise.resolve();
		},
		rejectFile: () => {
			return Promise.resolve();
		},
		createFile: () => {
			return Promise.resolve({ ok: true, savedAt: SAVED_AT });
		},
		save: () => {
			return Promise.resolve({ ok: true, savedAt: SAVED_AT });
		},
		writePreUpgradeBackup: () => {
			return Promise.resolve({ written: true, backupFileName: 'finances-pre-upgrade.spiccioli', retainedCount: 1 });
		},
		completeUpgrade: () => {
			return Promise.resolve({ ok: true, savedAt: SAVED_AT });
		},
		closeSession: () => {
			return Promise.resolve({ written: false });
		},
		cancelClose: () => {
			return Promise.resolve();
		},
		getBackupDirectory: () => {
			return Promise.resolve('/Documents/finances-backups');
		},
		getRecentFiles: () => {
			return Promise.resolve([]);
		},
		dismissRecentFile: () => {
			return Promise.resolve([]);
		},
		getPreferences: () => {
			return Promise.resolve(DEFAULT_PREFERENCES);
		},
		setPreferences: () => {
			return Promise.resolve();
		},
		onWriteAttemptFailed: unsubscribe,
		onExternalModification: unsubscribe,
		onMenuCommand: unsubscribe,
		onPrepareForClose: unsubscribe,
		...overrides
	};

	Object.defineProperty(window, 'spiccioliLedger', { configurable: true, value: bridge });
	stubPricesBridge();
	stubAppInfoBridge();
	Object.defineProperty(window, 'spiccioliDiagnostics', {
		configurable: true,
		value: {
			reportRenderError: () => {
				return Promise.resolve();
			}
		} satisfies SpiccioliDiagnosticsApi
	});

	return bridge;
};

// The nesting the real root uses, and it matters: the wording is provided inside the preferences, so that a number in a sentence
// is written with the separators in force
const AppTestProviders = ({ children }: { children: ReactNode }): ReactElement => {
	return (
		<PreferencesProvider>
			<TranslationProvider>
				<UnsavedDraftProvider>
					<LedgerProvider>
						<ChecksProvider>
							<MemoryRouter>
								<ScreenMemoryProvider>{children}</ScreenMemoryProvider>
							</MemoryRouter>
						</ChecksProvider>
					</LedgerProvider>
				</UnsavedDraftProvider>
			</TranslationProvider>
		</PreferencesProvider>
	);
};

/**
 * Renders something inside every provider a screen needs above it.
 * @param ui Element to render.
 * @returns The render result.
 */
export const renderWithProviders = (ui: ReactElement): RenderResult => {
	return render(ui, { wrapper: AppTestProviders });
};

/**
 * Renders the whole application, which starts on the launch screen because it never reopens the last file on its own.
 * @returns The render result.
 */
export const renderApp = (): RenderResult => {
	return renderWithProviders(<SpiccioliApp/>);
};

export const TEST_LEDGER_PATH = '/Documents/finances.spiccioli';

/**
 * Renders the application and opens a file through the launch screen, which is the only way into the shell.
 * @param document What the file holds. A seeded one, unless the test needs records in it.
 * @param overrides What else this test needs the bridge to answer.
 * @returns The render result, with the shell up and on Portfolio.
 */
export const renderOpenLedger = async(document: LedgerDocument = makeSeededDocument(), overrides: Partial<SpiccioliLedgerApi> = {}): Promise<RenderResult> => {
	stubLedgerBridge({
		getRecentFiles: () => {
			return Promise.resolve([ { filePath: TEST_LEDGER_PATH, lastOpenedAt: SAVED_AT, missing: false } ]);
		},
		readFile: () => {
			return Promise.resolve({
				outcome: 'read',
				filePath: TEST_LEDGER_PATH,
				contents: writeLedgerDocument(document),
				sizeBytes: 100
			});
		},
		...overrides
	});

	const result = renderApp();
	await userEvent.click(await screen.findByRole('button', { name: /finances\.spiccioli/ }));
	await screen.findByRole('heading', { name: 'Portfolio', level: 1 });

	return result;
};
