import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { StorageCommandResult, StorageFailure, StorageStatus } from 'src/framework/types/StorageTypes';

/**
 * What the renderer needs to know about storage writes: the latest database status, and whether something the user
 * changed is still not stored. The message is kept until that change is actually written, never cleared by an
 * unrelated command that happened to succeed.
 */
export interface StorageQueueState {
	status: StorageStatus | undefined;
	unsavedChangesMessage: string | undefined;
}

// "sendCommand" hands one command to the main process. It may reject: a thrown error is treated as a database failure and retried.
export interface CreateStorageQueueOptions<TCommand> {
	sendCommand: (command: TCommand) => Promise<StorageCommandResult>;

	// A database error the retries cannot fix, such as a full disk, would otherwise keep the failed write at the front of the queue and leave
	// every later change unwritten for the rest of the session, so the retries are bounded and the change is then reported as lost
	maximumWriteAttempts: number;
	writeRetryDelayMs: number;
	createUnsavedChangesMessage: (message: string) => string;
	createAbandonedChangeMessage: (message: string) => string;
}

export interface StorageQueue<TCommand> {
	sendCommand: (command: TCommand) => void;
	subscribe: (subscriber: () => void) => () => void;
	getState: () => StorageQueueState;

	// Writes the queued commands right away instead of waiting out the delay a failed write is retried after.
	// Used when the renderer is asked to save everything under a bounded time, which the retry delay alone could use up.
	retryNow: () => void;

	// Waits until every queued command is written. A command that keeps failing keeps the queue busy, so callers that
	// cannot wait forever must bound the wait themselves.
	waitForIdle: () => Promise<void>;

	// Whether everything the renderer changed has reached storage. Used by callers that must not act while the renderer is
	// legitimately ahead of storage, and that have nothing to do while it is, so waiting for the queue would only defer them.
	isIdle: () => boolean;

	// Forgets the warnings about changes that were not stored. Used when records are loaded again from the database,
	// because the renderer state does not hold those changes anymore.
	clearFailures: () => void;

	// Drops every queued command and resets the state. Only meant for tests, because a queue is shared by the whole renderer.
	reset: () => void;
}

const IDLE_STATE: StorageQueueState = {
	status: undefined,
	unsavedChangesMessage: undefined
};

// A database that failed once can work again, so those writes are kept and retried. Storage that refused a command because it is closing
// never even attempted it, so that command is kept too. A command the database refused as invalid would fail again in exactly the same
// way, so it is dropped and only reported.
const isRetryableFailure = (failure: StorageFailure): boolean => {
	return failure.reason === 'database-error' || failure.reason === 'shutdown';
};

export const createStorageQueue = <TCommand>({
	sendCommand,
	maximumWriteAttempts,
	writeRetryDelayMs,
	createUnsavedChangesMessage,
	createAbandonedChangeMessage
}: CreateStorageQueueOptions<TCommand>): StorageQueue<TCommand> => {
	// Storage commands are written one at a time and in order, so a failed one can be retried without letting later ones overtake it
	const queuedCommands: TCommand[] = [];

	const stateSubscribers = new Set<() => void>();

	const idleWaiters = new Set<() => void>();

	let queueState: StorageQueueState = IDLE_STATE;

	// A command the database refused is never written, so its warning cannot be cleared by later commands succeeding
	let droppedCommandMessage: string | undefined;

	// How many times in a row the database failed on the command at the front of the queue, so that retries of an error that never clears can be bounded
	let frontCommandDatabaseErrors = 0;

	let isWriting = false;

	let retryTimeout: ReturnType<typeof setTimeout> | undefined;

	const isQueueIdle = (): boolean => {
		return queuedCommands.length === 0 && !isWriting;
	};

	const notifyStateSubscribers = (): void => {
		stateSubscribers.forEach((subscriber) => {
			subscriber();
		});
	};

	const setQueueState = (nextState: StorageQueueState): void => {
		if(nextState.status === queueState.status && nextState.unsavedChangesMessage === queueState.unsavedChangesMessage) {
			return;
		}

		queueState = nextState;
		notifyStateSubscribers();
	};

	const releaseIdleWaiters = (): void => {
		const waiters = Array.from(idleWaiters);

		idleWaiters.clear();
		waiters.forEach((waiter) => {
			waiter();
		});
	};

	// A command refused while storage is closing was never attempted, and the process is going away anyway, so only the failures the database
	// itself reported are counted
	const countWriteResult = (result: StorageCommandResult): void => {
		frontCommandDatabaseErrors = !result.ok && result.reason === 'database-error' ? frontCommandDatabaseErrors + 1 : 0;
	};

	// Not every database error clears: a constraint violation or a full disk fails the same way every time, and retrying it forever would keep
	// every change made afterwards from ever being written, so the change is given up on and reported instead.
	const hasExhaustedWriteAttempts = (): boolean => {
		return frontCommandDatabaseErrors >= maximumWriteAttempts;
	};

	// A change the database gave up on is reported differently from one it refused outright, because the user made a change the application tried and failed to store
	const createDroppedCommandMessage = (failure: StorageFailure): string => {
		if(isRetryableFailure(failure)) {
			return createAbandonedChangeMessage(failure.message);
		}

		return createUnsavedChangesMessage(failure.message);
	};

	const dropFrontCommand = (message: string): void => {
		droppedCommandMessage = message;
		queuedCommands.shift();
		frontCommandDatabaseErrors = 0;
	};

	const writeCommand = async(command: TCommand): Promise<StorageCommandResult> => {
		try {
			return await sendCommand(command);
		}
		catch(error) {
			return {
				ok: false,
				reason: 'database-error',
				message: getErrorMessage(error),
				status: {
					database: {
						state: 'unavailable',
						message: getErrorMessage(error)
					}
				}
			};
		}
	};

	const scheduleRetry = (retryWrites: () => void): void => {
		if(retryTimeout) {
			return;
		}

		retryTimeout = setTimeout(() => {
			retryTimeout = undefined;
			retryWrites();
		}, writeRetryDelayMs);
	};

	const writeQueuedCommands = async(): Promise<void> => {
		if(isWriting) {
			return;
		}

		isWriting = true;

		try {
			while(queuedCommands.length > 0) {
				const result = await writeCommand(queuedCommands[0]);
				countWriteResult(result);

				if(!result.ok) {
					// The command stays at the front of the queue, so nothing written later can overtake it
					if(isRetryableFailure(result) && !hasExhaustedWriteAttempts()) {
						setQueueState({
							status: result.status,
							unsavedChangesMessage: createUnsavedChangesMessage(result.message)
						});
						scheduleRetry(() => {
							void writeQueuedCommands();
						});

						return;
					}

					dropFrontCommand(createDroppedCommandMessage(result));
					setQueueState({
						status: result.status,
						unsavedChangesMessage: droppedCommandMessage
					});

					continue;
				}

				queuedCommands.shift();
				setQueueState({
					status: result.status,
					unsavedChangesMessage: queueState.unsavedChangesMessage
				});
			}

			// Everything still writable is stored, so only a warning about a command that will never be written survives
			setQueueState({
				status: queueState.status,
				unsavedChangesMessage: droppedCommandMessage
			});
			releaseIdleWaiters();
		}
		finally {
			isWriting = false;
		}
	};

	return {
		sendCommand: (command: TCommand) => {
			queuedCommands.push(command);

			if(!retryTimeout) {
				void writeQueuedCommands();
			}
		},
		subscribe: (subscriber: () => void) => {
			stateSubscribers.add(subscriber);

			return () => {
				stateSubscribers.delete(subscriber);
			};
		},
		getState: () => {
			return queueState;
		},
		retryNow: () => {
			if(!retryTimeout) {
				return;
			}

			clearTimeout(retryTimeout);
			retryTimeout = undefined;
			void writeQueuedCommands();
		},
		waitForIdle: () => {
			if(isQueueIdle()) {
				return Promise.resolve();
			}

			return new Promise((resolve) => {
				idleWaiters.add(resolve);
			});
		},
		isIdle: isQueueIdle,
		clearFailures: () => {
			droppedCommandMessage = undefined;
			setQueueState({
				status: queueState.status,
				unsavedChangesMessage: undefined
			});
		},
		reset: () => {
			if(retryTimeout) {
				clearTimeout(retryTimeout);
				retryTimeout = undefined;
			}

			queuedCommands.length = 0;
			queueState = IDLE_STATE;
			droppedCommandMessage = undefined;
			frontCommandDatabaseErrors = 0;
			isWriting = false;
			idleWaiters.clear();
			stateSubscribers.clear();
		}
	};
};
