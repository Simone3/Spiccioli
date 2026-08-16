import type { App, IpcMain } from 'electron';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { StorageCommandResult, StorageStatus } from 'src/framework/types/StorageTypes';

export const DEFAULT_STORAGE_SHUTDOWN_MESSAGE = 'Storage is shutting down.';

type StorageIpcMain = Pick<IpcMain, 'handle'>;

type StorageIpcApp = Partial<Pick<App, 'on' | 'quit'>>;

// The renderer-facing storage operations this controller serializes. The load result stays generic because the controller only forwards it.
interface StorageIpcApi<TCommand, TLoadResult> {
	load: () => Promise<TLoadResult>;
	execute: (command: TCommand) => Promise<StorageCommandResult>;
	getStorageStatus: () => Promise<StorageStatus>;
	prepareForShutdown?: () => Promise<void>;
}

// The IPC channel names the application uses. They are application-owned, because they end up in the preload bridge as well.
export interface StorageIpcChannels {
	load: string;
	execute: string;
	getStatus: string;
	flushPendingChanges: string;
	pendingChangesFlushed: string;
}

interface BeforeQuitEvent {
	preventDefault: () => void;
}

export interface RendererFlushTarget {
	send: (channel: string) => void;
	isDestroyed?: () => boolean;
}

export interface StorageCommandController {
	runExclusively: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;

	// Runs the renderer flush handshake for a window that is about to close, or returns undefined when the window has nothing to wait for
	requestRendererFlushBeforeWindowClose: () => Promise<void> | undefined;
}

export interface RegisterStorageIpcHandlersOptions<TCommand, TLoadResult> {
	ipcMain: StorageIpcMain;
	channels: StorageIpcChannels;
	storage: StorageIpcApi<TCommand, TLoadResult>;

	// How long the renderer is given to write the changes it still buffers before the database is closed
	rendererFlushTimeoutMs: number;
	shutdownMessage?: string;
	app?: StorageIpcApp;
	getRendererFlushTarget?: () => RendererFlushTarget | undefined;

	// Called after every command that reached the database, so the backup schedule can be restarted
	onCommandApplied?: () => void;

	// Called once the renderer had its last chance to save and before the first command is refused, so the application can stop the
	// user from changing anything else. The drain, the last backup and the database close take seconds, and a window left on screen
	// keeps collecting changes that are refused, retried after the process is gone, and lost.
	onRendererFlushCompleted?: () => void;

	// Called once the in-flight commands are done and before the database is closed, so a last backup can still read it
	onBeforeStorageShutdown?: () => Promise<void>;
}

const createShutdownStorageStatus = (shutdownMessage: string): StorageStatus => {
	return {
		database: {
			state: 'unavailable',
			message: shutdownMessage
		}
	};
};

const readStorageStatusSafely = async<TCommand, TLoadResult>(
	storage: StorageIpcApi<TCommand, TLoadResult>,
	shutdownMessage: string
): Promise<StorageStatus> => {
	try {
		return await storage.getStorageStatus();
	}
	catch {
		return createShutdownStorageStatus(shutdownMessage);
	}
};

const createShutdownCommandResult = async<TCommand, TLoadResult>(
	storage: StorageIpcApi<TCommand, TLoadResult>,
	shutdownMessage: string
): Promise<StorageCommandResult> => {
	return {
		ok: false,
		reason: 'shutdown',
		message: shutdownMessage,
		status: await readStorageStatusSafely(storage, shutdownMessage)
	};
};

const createStorageCommandController = <TCommand, TLoadResult>({
	channels,
	storage,
	rendererFlushTimeoutMs,
	shutdownMessage = DEFAULT_STORAGE_SHUTDOWN_MESSAGE,
	app,
	getRendererFlushTarget,
	onCommandApplied,
	onRendererFlushCompleted,
	onBeforeStorageShutdown
}: RegisterStorageIpcHandlersOptions<TCommand, TLoadResult>): Pick<StorageIpcApi<TCommand, TLoadResult>, 'load' | 'execute'> & StorageCommandController & {
	notifyPendingChangesFlushed: () => void;
} => {
	// Everything that touches the database runs on this chain, so storage commands and backup folder changes are strictly
	// ordered and can never overlap, whichever order they are requested in
	let storageOperations: Promise<unknown> = Promise.resolve();
	let isShuttingDown = false;
	let isQuitAllowed = false;
	let shutdownPromise: Promise<void> | undefined;
	let rendererFlushPromise: Promise<void> | undefined;
	let finishRendererFlush: (() => void) | undefined;

	const runOnStorage = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
		const operationResult = storageOperations.then(() => {
			return operation();
		});

		// The chain has to survive a failed operation, or nothing would run after it
		storageOperations = operationResult.then(() => {
			return undefined;
		}, () => {
			return undefined;
		});

		return operationResult;
	};

	const drainStorageOperations = async(): Promise<void> => {
		let drainedOperations;

		// An operation can be appended while the previous ones are being awaited
		do {
			drainedOperations = storageOperations;
			await drainedOperations;
		}
		while(drainedOperations !== storageOperations);
	};

	// The last backup runs once nothing is left to write and while the database is still open, and it is best effort: a backup folder that
	// cannot be reached must never keep the app from quitting
	const runFinalBackup = async(): Promise<void> => {
		try {
			await onBeforeStorageShutdown?.();
		}
		catch(error) {
			appLogger.error('The backup written during shutdown failed', {
				type: 'storage.backup',
				error: getErrorMessage(error)
			});
		}
	};

	const prepareForShutdown = async(): Promise<void> => {
		await drainStorageOperations();
		await runFinalBackup();
		try {
			await storage.prepareForShutdown?.();
		}
		finally {
			await appLogger.flush();
		}
	};

	// The renderer buffers changes for a few seconds, so it gets a bounded chance to save them before the database is closed.
	// Storage commands are still accepted while this runs: rejecting them here is exactly what would lose the buffered edits.
	const requestRendererFlush = (): Promise<void> | undefined => {
		const flushTarget = getRendererFlushTarget?.();

		if(!flushTarget || flushTarget.isDestroyed?.()) {
			return undefined;
		}

		return new Promise<void>((resolve) => {
			let flushTimeout: ReturnType<typeof setTimeout> | undefined;
			const finishFlush = (): void => {
				if(!finishRendererFlush) {
					return;
				}

				finishRendererFlush = undefined;
				clearTimeout(flushTimeout);
				resolve();
			};

			flushTimeout = setTimeout(finishFlush, rendererFlushTimeoutMs);
			finishRendererFlush = finishFlush;

			try {
				flushTarget.send(channels.flushPendingChanges);
			}
			catch(error) {
				appLogger.warn('Could not ask the renderer to flush pending changes', {
					type: 'storage.shutdown',
					error: getErrorMessage(error)
				});
				finishFlush();
			}
		});
	};

	// A window closing while the application is quitting, or the other way around, must join the handshake that is already
	// running instead of starting a second one the renderer would answer only once
	const requestRendererFlushOnce = (): Promise<void> | undefined => {
		if(rendererFlushPromise) {
			return rendererFlushPromise;
		}

		const flushPromise = requestRendererFlush();

		if(!flushPromise) {
			return undefined;
		}

		rendererFlushPromise = flushPromise.then(() => {
			rendererFlushPromise = undefined;
		});

		return rendererFlushPromise;
	};

	// Closing the window destroys the renderer, and on macOS the application even keeps running afterwards, so the buffered
	// changes have to be saved when the window goes away and not only when the application quits
	const requestRendererFlushBeforeWindowClose = (): Promise<void> | undefined => {
		// A quit runs the same handshake, so the window must not ask for a second one. It still has to wait for the one already running,
		// though: destroying the window while the renderer is flushing would tear it down halfway through and lose what it had left to write.
		// Once that handshake is done, and when the quit had no renderer to ask in the first place, the window closes right away.
		if(shutdownPromise) {
			return rendererFlushPromise;
		}

		return requestRendererFlushOnce();
	};

	// From here on nothing the renderer sends can be stored anymore, so the application is asked to stop the user from changing
	// anything else. Draining, backing up and closing the database takes seconds, and every change made during that time would be
	// refused, scheduled for a retry the process will not live to run, and lost.
	const startRefusingCommands = (): void => {
		if(isShuttingDown) {
			return;
		}

		isShuttingDown = true;
		onRendererFlushCompleted?.();
	};

	const requestShutdown = (): void => {
		if(shutdownPromise) {
			return;
		}

		const pendingRendererFlush = requestRendererFlushOnce();

		// Without a renderer to wait for, shutdown starts right away and later commands are refused immediately
		if(!pendingRendererFlush) {
			startRefusingCommands();
		}

		shutdownPromise = (pendingRendererFlush ?? Promise.resolve())
			.then(() => {
				startRefusingCommands();

				return prepareForShutdown();
			})
			.catch(() => {
				return undefined;
			})
			.then(() => {
				isQuitAllowed = true;
				app?.quit?.();
			});
	};

	app?.on?.('before-quit', (event: BeforeQuitEvent) => {
		if(isQuitAllowed) {
			return;
		}

		event.preventDefault();
		requestShutdown();
	});

	// Lets a backup folder change finalize the commands already running on the old database, while later commands wait
	// for the new one instead of racing the switch, and a second folder change waits for the first to finish
	const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
		return runOnStorage(operation);
	};

	return {
		load: () => {
			return runOnStorage(() => {
				return storage.load();
			});
		},
		execute: async(command) => {
			if(isShuttingDown) {
				return createShutdownCommandResult(storage, shutdownMessage);
			}

			const result = await runOnStorage(() => {
				return storage.execute(command);
			});

			if(result.ok) {
				onCommandApplied?.();
			}

			return result;
		},
		runExclusively,
		requestRendererFlushBeforeWindowClose,
		notifyPendingChangesFlushed: () => {
			finishRendererFlush?.();
		}
	};
};

export const registerStorageIpcHandlers = <TCommand, TLoadResult>(
	options: RegisterStorageIpcHandlersOptions<TCommand, TLoadResult>
): StorageCommandController => {
	const { ipcMain, channels, storage } = options;
	const commandController = createStorageCommandController(options);

	// Loading also goes through the chain, so records are never read from a database that is being replaced
	ipcMain.handle(channels.load, () => {
		return commandController.load();
	});

	ipcMain.handle(channels.execute, (_event, command: TCommand) => {
		return commandController.execute(command);
	});

	ipcMain.handle(channels.getStatus, () => {
		return storage.getStorageStatus();
	});

	ipcMain.handle(channels.pendingChangesFlushed, () => {
		commandController.notifyPendingChangesFlushed();
	});

	return {
		runExclusively: commandController.runExclusively,
		requestRendererFlushBeforeWindowClose: commandController.requestRendererFlushBeforeWindowClose
	};
};
