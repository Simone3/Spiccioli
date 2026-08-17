import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeSeededDocument, renderWithTranslations } from '../testUtils';
import { SpiccioliApp } from 'src/components/SpiccioliApp';
import { LedgerProvider } from 'src/contexts/LedgerContext';
import { PreferencesProvider } from 'src/contexts/PreferencesContext';
import { LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { SpiccioliDiagnosticsApi, SpiccioliLedgerApi } from 'src/types/LedgerIpcTypes';

const noop = (): void => {
	return undefined;
};

const unsubscribe = (): () => void => {
	return noop;
};

// Everything the bridge publishes, stubbed. Only what a test cares about is overridden.
const stubLedgerBridge = (overrides: Partial<SpiccioliLedgerApi> = {}): SpiccioliLedgerApi => {
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
			return Promise.resolve({ ok: true, savedAt: new Date(2026, 7, 8, 14, 32).toISOString() });
		},
		save: () => {
			return Promise.resolve({ ok: true, savedAt: new Date(2026, 7, 8, 14, 32).toISOString() });
		},
		writePreUpgradeBackup: () => {
			return Promise.resolve({ written: true, backupFileName: 'finances-pre-upgrade.spiccioli', retainedCount: 1 });
		},
		completeUpgrade: () => {
			return Promise.resolve({ ok: true, savedAt: new Date(2026, 7, 8, 14, 32).toISOString() });
		},
		closeSession: () => {
			return Promise.resolve({ written: false });
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

const renderApp = (): void => {
	renderWithTranslations(
		<PreferencesProvider>
			<LedgerProvider>
				<SpiccioliApp/>
			</LedgerProvider>
		</PreferencesProvider>
	);
};

describe('the launch screen', () => {
	test('is what the application opens with, and never reopens the last file on its own', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Documents/finances.spiccioli', lastOpenedAt: new Date(2026, 7, 7, 18, 4).toISOString(), missing: false } ]);
			}
		});

		renderApp();

		expect(await screen.findByText('Choose a file to open')).toBeInTheDocument();
		expect(await screen.findByText('finances.spiccioli')).toBeInTheDocument();
	});

	test('offers only the two actions when nothing has been opened yet', async() => {
		stubLedgerBridge();
		renderApp();

		expect(await screen.findByRole('button', { name: 'Open…' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'New file…' })).toBeInTheDocument();
	});

	test('shows a recent entry whose file has moved struck through, and keeps it openable by nothing', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Desktop/test.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: true } ]);
			}
		});

		renderApp();

		const entry = await screen.findByRole('button', { name: /test\.spiccioli/ });

		expect(entry).toBeDisabled();
		expect(screen.getByText(/not found — moved or deleted/)).toBeInTheDocument();
	});

	test('opens a file the reader understands and leaves the launch screen', async() => {
		const document = makeSeededDocument();
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Documents/finances.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: false } ]);
			},
			readFile: () => {
				return Promise.resolve({
					outcome: 'read',
					filePath: '/Documents/finances.spiccioli',
					contents: writeLedgerDocument(document),
					sizeBytes: 100
				});
			}
		});

		renderApp();
		await userEvent.click(await screen.findByRole('button', { name: /finances\.spiccioli/ }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'finances' })).toBeInTheDocument();
		});
		expect(screen.queryByText('Choose a file to open')).not.toBeInTheDocument();
	});

	test('states what was not understood about a file, with the other files still openable', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([
					{ filePath: '/Documents/broken.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: false },
					{ filePath: '/Documents/finances.spiccioli', lastOpenedAt: new Date(2026, 7, 6).toISOString(), missing: false }
				]);
			},
			readFile: () => {
				return Promise.resolve({
					outcome: 'read',
					filePath: '/Documents/broken.spiccioli',
					contents: JSON.stringify({ schemaVersion: LEDGER_SCHEMA_VERSION + 1 }),
					sizeBytes: 20
				});
			}
		});

		renderApp();
		await userEvent.click(await screen.findByRole('button', { name: /broken\.spiccioli/ }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/schema version/);
		expect(screen.getByRole('button', { name: /finances\.spiccioli/ })).toBeEnabled();
	});

	test('lets the refusal be dismissed, leaving the launch screen as it was', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Documents/broken.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: false } ]);
			},
			readFile: () => {
				return Promise.resolve({
					outcome: 'read',
					filePath: '/Documents/broken.spiccioli',
					contents: '{ not json',
					sizeBytes: 10
				});
			}
		});

		renderApp();
		await userEvent.click(await screen.findByRole('button', { name: /broken\.spiccioli/ }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/);

		await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByText('Choose a file to open')).toBeInTheDocument();
	});
});
