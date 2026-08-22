import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { STORAGE_CONFIG } from 'src/config/AppConfig';
import { useUnsavedDraftGuard } from 'src/contexts/UnsavedDraftContext';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import { useTranslator } from 'src/i18n/TranslationContext';
import { createSeededLedgerDocument, LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import { readLedgerDocument } from 'src/logic/ledger/LedgerReader';
import { redactLedgerRefusal, type LedgerRefusal } from 'src/logic/ledger/LedgerRefusal';
import { upgradeLedgerDocument, type LedgerUpgradeCounts } from 'src/logic/ledger/LedgerUpgrade';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import { createAutosaveScheduler, type AutosaveScheduler } from 'src/logic/storage/AutosaveScheduler';
import { LEDGER_ENTITY_KEYS, type LedgerDocument, type LedgerEntityKey } from 'src/types/LedgerTypes';
import type { LedgerBackupResult, LedgerCloseDoor, LedgerExternalModificationEvent, LedgerWriteResult } from 'src/types/LedgerIpcTypes';

/**
 * The ledger, in memory, and everything that happens to the file it came out of.
 *
 * **The renderer holds the model.** It reads the file the main process hands it, it writes the text the main process puts on
 * disk, and every screen from here on reads the document out of this context. The main process never sees a parsed ledger and
 * this context never sees a filesystem.
 *
 * It also owns the three things the storage specification puts on screen: the save state, the line while a failed write is
 * being retried and the blocking message after the fifth attempt, and the line saying something else changed the file.
 */

export type LedgerSaveState = {
	state: 'idle';
} | {
	state: 'saved';
	savedAt: string;
} | {
	state: 'retrying';
	attempt: number;
	maximumAttempts: number;
	message: string;
} | {
	state: 'failed';
	filePath: string;
	message: string;
};

// What kept a file from opening, shown on the launch screen with the other files still openable
export type LedgerOpenFailure = {
	kind: 'unreadable';
	filePath: string;
	message: string;
} | {
	kind: 'refused';
	filePath: string;
	refusal: LedgerRefusal;
};

/**
 * What is in front of the user when a close found changes that never reached the file.
 *
 * The session cannot simply end there — everything in it is in memory and nothing else has a copy — and it cannot simply refuse
 * to end either, since the way out may well be to give the changes up. So the departure waits here, and the two answers are the
 * only two there are: give them up and go, or keep them and stay.
 */
export interface UnwrittenChangesPrompt {
	filePath: string;

	// What the system said about the last attempt, which is the only thing anybody can act on
	message: string;
}

export interface LedgerUpgradePrompt {
	filePath: string;
	rawDocument: unknown;
	fromSchemaVersion: number;
	toSchemaVersion: number;

	// Set when the pre-upgrade copy could not be written, which stops the upgrade and offers Retry and Cancel
	backupFailureMessage?: string;
}

export interface LedgerContextValue {
	document: LedgerDocument | undefined;
	filePath: string | undefined;
	saveState: LedgerSaveState;
	openFailure: LedgerOpenFailure | undefined;
	upgradePrompt: LedgerUpgradePrompt | undefined;
	externalModification: LedgerExternalModificationEvent | undefined;
	closingBackupFailureMessage: string | undefined;
	unwrittenChangesPrompt: UnwrittenChangesPrompt | undefined;
	isBusy: boolean;

	// Whether a write is running right now, which is what keeps the blocking message's *Retry* from starting a second one
	isSaving: boolean;

	openWithDialog: () => Promise<void>;
	openPath: (filePath: string) => Promise<void>;
	createWithDialog: () => Promise<void>;
	confirmUpgrade: () => Promise<void>;
	cancelUpgrade: () => void;
	dismissOpenFailure: () => void;
	dismissExternalModification: () => void;
	dismissClosingBackupFailure: () => void;

	// The two answers to a close that found changes the file never took
	discardUnwrittenChanges: () => Promise<void>;
	keepUnwrittenChanges: () => void;

	retrySave: () => Promise<void>;
	updateDocument: (updater: (document: LedgerDocument) => LedgerDocument) => void;
}

const LedgerContext = createContext<LedgerContextValue | undefined>(undefined);

const countRecords = (document: LedgerDocument): Record<LedgerEntityKey, number> => {
	return Object.fromEntries(LEDGER_ENTITY_KEYS.map((key) => {
		return [ key, document[key].length ];
	})) as Record<LedgerEntityKey, number>;
};

/**
 * Provides the open ledger and the actions that change which file is open.
 * @param props The provider's props.
 * @param props.children The tree that reads the ledger.
 * @returns The provider.
 */
export const LedgerProvider = ({ children }: { children: ReactNode }): ReactElement => {
	const translator = useTranslator();
	const { requestDeparture } = useUnsavedDraftGuard();
	const [ document, setDocument ] = useState<LedgerDocument | undefined>();
	const [ filePath, setFilePath ] = useState<string | undefined>();
	const [ saveState, setSaveState ] = useState<LedgerSaveState>({ state: 'idle' });
	const [ openFailure, setOpenFailure ] = useState<LedgerOpenFailure | undefined>();
	const [ upgradePrompt, setUpgradePrompt ] = useState<LedgerUpgradePrompt | undefined>();
	const [ externalModification, setExternalModification ] = useState<LedgerExternalModificationEvent | undefined>();
	const [ closingBackupFailureMessage, setClosingBackupFailureMessage ] = useState<string | undefined>();
	const [ unwrittenChangesPrompt, setUnwrittenChangesPrompt ] = useState<UnwrittenChangesPrompt | undefined>();
	const [ isBusy, setIsBusy ] = useState(false);
	const [ isSaving, setIsSaving ] = useState(false);

	// The document as the autosave and the retry see it, which has to be the newest one rather than the one this render closed over
	const documentRef = useRef<LedgerDocument | undefined>(undefined);

	// The open file as the scheduler sees it, for the same reason: a write that rejected has to name the file it was about, and
	// the scheduler is built once and never closes over a later render
	const filePathRef = useRef<string | undefined>(undefined);
	const schedulerRef = useRef<AutosaveScheduler | undefined>(undefined);

	// The last write that failed, or undefined once one has succeeded. **This is how a close knows whether the file has
	// everything**: a failed write leaves nothing pending — the contents were taken out of the queue before they were attempted
	// — so the queue being empty is not the same as the file being written, and only this says which.
	const lastWriteFailureRef = useRef<{ filePath: string; message: string } | undefined>(undefined);

	// The departure the unwritten-changes prompt is up for, kept until the user answers it
	const pendingCloseRef = useRef<{ door: LedgerCloseDoor; proceed?: () => Promise<void> } | undefined>(undefined);

	const applyWriteResult = useCallback((result: LedgerWriteResult): void => {
		lastWriteFailureRef.current = result.ok ? undefined : { filePath: result.filePath, message: result.message };
		setSaveState(result.ok ?
			{ state: 'saved', savedAt: result.savedAt } :
			{ state: 'failed', filePath: result.filePath, message: result.message });
	}, []);

	if(!schedulerRef.current) {
		schedulerRef.current = createAutosaveScheduler<LedgerWriteResult>({
			debounceMs: STORAGE_CONFIG.autosaveDebounceMs,
			save: (contents) => {
				return window.spiccioliLedger.save(contents);
			},

			// A save that rejected never reached the file and never said so. It is reported as the failed write it was, so that
			// the line on screen names it and the close finds it rather than taking the session for written.
			onSaveRejected: (error) => {
				return {
					ok: false,
					filePath: filePathRef.current ?? '',
					message: getErrorMessage(error)
				};
			},
			onResult: applyWriteResult
		});
	}

	const setOpenDocument = useCallback((nextFilePath: string, nextDocument: LedgerDocument): void => {
		documentRef.current = nextDocument;
		filePathRef.current = nextFilePath;
		setDocument(nextDocument);
		setFilePath(nextFilePath);
		setSaveState({ state: 'idle' });
		setOpenFailure(undefined);
		setUpgradePrompt(undefined);
	}, []);

	// A door the main process is holding open for an answer, as opposed to one this window opened for itself
	const isShutdownDoor = (door: LedgerCloseDoor): boolean => {
		return door === 'quit' || door === 'window-closed';
	};

	const closeSessionNow = useCallback(async(door: LedgerCloseDoor): Promise<LedgerBackupResult> => {
		const backup = await window.spiccioliLedger.closeSession({ door });

		documentRef.current = undefined;
		filePathRef.current = undefined;
		lastWriteFailureRef.current = undefined;
		setDocument(undefined);
		setFilePath(undefined);
		setSaveState({ state: 'idle' });
		setExternalModification(undefined);
		setClosingBackupFailureMessage(backup.written || !backup.message ? undefined : backup.message);

		return backup;
	}, []);

	/**
	 * Whatever ends the session — a menu action, the window closing, a quit — comes through here, so that the file is never left
	 * with a write still waiting and the closing copy is taken with everything already on disk.
	 *
	 * **A close that cannot write is not a close.** Everything in the session is in memory and the file is the only place it can
	 * go, so a flush that ends with the file still not holding the changes stops here and asks, rather than dropping the model on
	 * the floor with the failure it was reporting a moment ago wiped off the screen with it.
	 * @param door Which of the four doors the session is leaving by.
	 * @param proceed What the departure was going to do next, replayed if the changes are given up.
	 * @returns Whether the session actually closed.
	 */
	const endSession = useCallback(async(door: LedgerCloseDoor, proceed?: () => Promise<void>): Promise<boolean> => {
		await schedulerRef.current?.flush();

		const failure = lastWriteFailureRef.current;

		if(failure) {
			pendingCloseRef.current = { door, proceed };
			setUnwrittenChangesPrompt({ filePath: failure.filePath, message: failure.message });

			// The main process is counting, and a person reading a dialog is slower than anything it is counting for
			if(isShutdownDoor(door)) {
				void window.spiccioliLedger.pauseClose();
			}

			return false;
		}

		await closeSessionNow(door);

		return true;
	}, [ closeSessionNow ]);

	// Reading, parsing and either opening the file or saying what was not understood about it. Every way into a file lands here.
	const readAndOpen = useCallback(async(pathToOpen: string): Promise<void> => {
		const read = await window.spiccioliLedger.readFile(pathToOpen);

		if(read.outcome === 'unreadable') {
			setOpenFailure({ kind: 'unreadable', filePath: read.filePath, message: read.message });

			return;
		}

		const startedAt = performance.now();
		const result = readLedgerDocument(read.contents);
		const parseDurationMs = Math.round(performance.now() - startedAt);

		if(result.outcome === 'refused') {
			setOpenFailure({ kind: 'refused', filePath: read.filePath, refusal: result.refusal });
			await window.spiccioliLedger.rejectFile({ filePath: read.filePath, refusal: redactLedgerRefusal(result.refusal) });

			return;
		}

		if(result.outcome === 'upgrade-required') {
			setUpgradePrompt({
				filePath: read.filePath,
				rawDocument: result.rawDocument,
				fromSchemaVersion: result.fromSchemaVersion,
				toSchemaVersion: result.toSchemaVersion
			});

			return;
		}

		await window.spiccioliLedger.acceptFile({
			filePath: read.filePath,
			schemaVersion: result.document.schemaVersion,
			recordCounts: countRecords(result.document),
			parseDurationMs
		});
		setOpenDocument(read.filePath, result.document);
	}, [ setOpenDocument ]);

	// A file being opened while another one is open is a close of that session first, and a refusal then leaves the one that was
	// already open exactly where it was
	const withSessionClosed = useCallback(async(door: LedgerCloseDoor, action: () => Promise<void>): Promise<void> => {
		setIsBusy(true);

		try {
			// A close the user has still to answer for leaves the file open and the departure waiting on the prompt
			if(documentRef.current && !await endSession(door, action)) {
				return;
			}

			await action();
		}
		finally {
			setIsBusy(false);
		}
	}, [ endSession ]);

	// Giving the changes up is the only way the file closes with them still unwritten, and it is the user who says so
	const discardUnwrittenChanges = useCallback(async(): Promise<void> => {
		const pending = pendingCloseRef.current;

		if(!pending) {
			return;
		}

		pendingCloseRef.current = undefined;
		setUnwrittenChangesPrompt(undefined);
		setIsBusy(true);

		try {
			await closeSessionNow(pending.door);
			await pending.proceed?.();
		}
		finally {
			setIsBusy(false);
		}

		// The main process is still holding the door: the session is closed now, and its own poll is what lets it through
	}, [ closeSessionNow ]);

	// Staying keeps the session exactly as it was, with the write-failure message still saying what stopped it
	const keepUnwrittenChanges = useCallback((): void => {
		const pending = pendingCloseRef.current;

		if(!pending) {
			return;
		}

		pendingCloseRef.current = undefined;
		setUnwrittenChangesPrompt(undefined);

		if(isShutdownDoor(pending.door)) {
			void window.spiccioliLedger.cancelClose();
		}
	}, []);

	const openPath = useCallback((pathToOpen: string): Promise<void> => {
		return withSessionClosed('open-file', () => {
			return readAndOpen(pathToOpen);
		});
	}, [ readAndOpen, withSessionClosed ]);

	const openWithDialog = useCallback(async(): Promise<void> => {
		const chosen = await window.spiccioliLedger.chooseFileToOpen();

		if(chosen.cancelled) {
			return;
		}

		await openPath(chosen.filePath);
	}, [ openPath ]);

	const createWithDialog = useCallback(async(): Promise<void> => {
		const chosen = await window.spiccioliLedger.chooseFileToCreate();

		if(chosen.cancelled) {
			return;
		}

		await withSessionClosed('new-file', async() => {
			const seeded = createSeededLedgerDocument(translator);
			const result = await window.spiccioliLedger.createFile({
				filePath: chosen.filePath,
				contents: writeLedgerDocument(seeded),
				schemaVersion: LEDGER_SCHEMA_VERSION
			});

			if(!result.ok) {
				setOpenFailure({ kind: 'unreadable', filePath: result.filePath, message: result.message });

				return;
			}

			setOpenDocument(chosen.filePath, seeded);
		});
	}, [ setOpenDocument, translator, withSessionClosed ]);

	// The pre-upgrade copy is what makes an upgrade reversible, so a copy that cannot be written stops it and nothing is written
	// to the file either way
	const confirmUpgrade = useCallback(async(): Promise<void> => {
		const prompt = upgradePrompt;

		if(!prompt) {
			return;
		}

		setIsBusy(true);

		try {
			const backup = await window.spiccioliLedger.writePreUpgradeBackup();

			if(!backup.written) {
				setUpgradePrompt({ ...prompt, backupFailureMessage: backup.message });

				return;
			}

			const result = upgradeLedgerDocument({
				rawDocument: prompt.rawDocument,
				fromSchemaVersion: prompt.fromSchemaVersion,
				toSchemaVersion: prompt.toSchemaVersion
			});

			if(result.outcome === 'refused') {
				setUpgradePrompt(undefined);
				setOpenFailure({ kind: 'refused', filePath: prompt.filePath, refusal: result.refusal });
				await window.spiccioliLedger.rejectFile({ filePath: prompt.filePath, refusal: redactLedgerRefusal(result.refusal) });

				return;
			}

			const counts: LedgerUpgradeCounts = result.counts;
			const written = await window.spiccioliLedger.completeUpgrade({
				contents: writeLedgerDocument(result.document),
				fromSchemaVersion: result.fromSchemaVersion,
				toSchemaVersion: result.toSchemaVersion,
				...counts
			});

			if(!written.ok) {
				setUpgradePrompt({ ...prompt, backupFailureMessage: written.message });

				return;
			}

			setOpenDocument(prompt.filePath, result.document);
		}
		finally {
			setIsBusy(false);
		}
	}, [ setOpenDocument, upgradePrompt ]);

	const updateDocument = useCallback((updater: (current: LedgerDocument) => LedgerDocument): void => {
		const current = documentRef.current;

		if(!current) {
			return;
		}

		const next = updater(current);

		documentRef.current = next;
		setDocument(next);
		schedulerRef.current?.schedule(writeLedgerDocument(next));
	}, []);

	// The blocking message's own Retry runs the same write again, and succeeding puts the session back exactly where it was.
	// **It goes through the scheduler like every other write**: a save of its own would be a second writer on one file, and two
	// of those fill the same temporary file and rename a splice of both onto the ledger.
	const retrySave = useCallback(async(): Promise<void> => {
		const current = documentRef.current;

		if(!current) {
			return;
		}

		setIsSaving(true);

		try {
			await schedulerRef.current?.saveNow(writeLedgerDocument(current));
		}
		finally {
			setIsSaving(false);
		}
	}, []);

	useEffect(() => {
		const unsubscribeAttempt = window.spiccioliLedger.onWriteAttemptFailed((event) => {
			// The last attempt's failure is reported by the write itself, which is what turns the line into the blocking message
			if(event.attempt < event.maximumAttempts) {
				setSaveState({
					state: 'retrying',
					attempt: event.attempt,
					maximumAttempts: event.maximumAttempts,
					message: event.message
				});
			}
		});
		const unsubscribeExternal = window.spiccioliLedger.onExternalModification((event) => {
			setExternalModification(event);
		});

		return () => {
			unsubscribeAttempt();
			unsubscribeExternal();
		};
	}, []);

	useEffect(() => {
		// All three menu actions end the current session, so all three are a departure and go through the guard first
		const unsubscribeMenu = window.spiccioliLedger.onMenuCommand((command) => {
			requestDeparture(() => {
				if(command.command === 'new-file') {
					void createWithDialog();
				}
				else if(command.command === 'open-file') {
					void openWithDialog();
				}
				else {
					void openPath(command.filePath);
				}
			});
		});

		// A quit or a closed window is a close like any other: everything pending is written, and the closing copy is taken.
		// Staying is the one answer that is not a close, and the main process has to be told so it can call the quit off — which
		// is true of the draft guard here and of the unwritten-changes prompt "endSession" raises for itself.
		const unsubscribeClose = window.spiccioliLedger.onPrepareForClose((door) => {
			const departed = requestDeparture(
				() => {
					void endSession(door);
				},
				() => {
					void window.spiccioliLedger.cancelClose();
				}
			);

			// The draft prompt is up, and the main process is counting. It has to be told, for exactly the reason "endSession"
			// tells it about its own prompt: a person reading a dialog is slower than anything it is counting for, and a close
			// that gave up on one would destroy the very draft it had just asked what to do about.
			if(!departed) {
				void window.spiccioliLedger.pauseClose();
			}
		});

		return () => {
			unsubscribeMenu();
			unsubscribeClose();
		};
	}, [ createWithDialog, endSession, openPath, openWithDialog, requestDeparture ]);

	const value = useMemo((): LedgerContextValue => {
		return {
			document,
			filePath,
			saveState,
			openFailure,
			upgradePrompt,
			externalModification,
			closingBackupFailureMessage,
			unwrittenChangesPrompt,
			isBusy,
			isSaving,
			openWithDialog,
			openPath,
			createWithDialog,
			confirmUpgrade,
			cancelUpgrade: () => {
				setUpgradePrompt(undefined);
			},
			dismissOpenFailure: () => {
				setOpenFailure(undefined);
			},
			dismissExternalModification: () => {
				setExternalModification(undefined);
			},
			dismissClosingBackupFailure: () => {
				setClosingBackupFailureMessage(undefined);
			},
			discardUnwrittenChanges,
			keepUnwrittenChanges,
			retrySave,
			updateDocument
		};
	}, [
		closingBackupFailureMessage,
		confirmUpgrade,
		createWithDialog,
		discardUnwrittenChanges,
		document,
		externalModification,
		filePath,
		isBusy,
		isSaving,
		keepUnwrittenChanges,
		openFailure,
		openPath,
		openWithDialog,
		retrySave,
		saveState,
		unwrittenChangesPrompt,
		updateDocument,
		upgradePrompt
	]);

	return (
		<LedgerContext.Provider value={value}>
			{children}
		</LedgerContext.Provider>
	);
};

/**
 * Reads the open ledger and the actions that change which file is open.
 * @returns The ledger context.
 */
export const useLedger = (): LedgerContextValue => {
	const value = useContext(LedgerContext);

	if(!value) {
		throw new Error('useLedger was called outside the LedgerProvider.');
	}

	return value;
};
