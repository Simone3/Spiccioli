/**
 * Autosave, debounced.
 *
 * Every change to the model schedules a write, and a write that is already scheduled is pushed back rather than added to: what
 * reaches the file is the state after the last keystroke, not one file per keystroke. Only the newest contents are ever kept,
 * so a burst of edits costs one write.
 *
 * **Writes never overlap, and every write of the open file goes through here.** A change made while a write is in flight is
 * written after it finishes, which matters because a failing write is being retried for the better part of a minute behind this
 * and a second write starting inside that window would be racing it for the same file. That is why the blocking failure
 * message's *Retry* is `saveNow` and not a save of its own: the one thing it must not do is start a second writer.
 *
 * This holds no React and no Electron: it is handed a function that writes and it decides when to call it.
 */

export interface CreateAutosaveSchedulerOptions<TResult> {
	debounceMs: number;
	save: (contents: string) => Promise<TResult>;
	onResult: (result: TResult) => void;

	// Injected by the tests, which drive the clock themselves
	setTimer?: (callback: () => void, delayMs: number) => unknown;
	clearTimer?: (handle: unknown) => void;
}

export interface AutosaveScheduler {

	// Records the newest contents and starts, or restarts, the wait before they are written
	schedule: (contents: string) => void;

	// Writes whatever is waiting right away and resolves once nothing is left to write. Called before the file stops being the open one.
	flush: () => Promise<void>;

	// Writes these contents without waiting, behind whatever is already in flight. It is what the blocking write-failure
	// message's own *Retry* runs: a write of its own would be a second one racing the first for the same file.
	saveNow: (contents: string) => Promise<void>;

	hasPendingChanges: () => boolean;
}

export const createAutosaveScheduler = <TResult>({
	debounceMs,
	save,
	onResult,
	setTimer = (callback, delayMs) => {
		return setTimeout(callback, delayMs);
	},
	clearTimer = (handle) => {
		clearTimeout(handle as ReturnType<typeof setTimeout>);
	}
}: CreateAutosaveSchedulerOptions<TResult>): AutosaveScheduler => {
	let pendingContents: string | undefined;
	let timerHandle: unknown;
	let writeInFlight: Promise<void> | undefined;

	const cancelTimer = (): void => {
		if(timerHandle !== undefined) {
			clearTimer(timerHandle);
			timerHandle = undefined;
		}
	};

	// Drains whatever is pending, one write at a time, until nothing has arrived while the last one was running
	const drain = async(): Promise<void> => {
		while(pendingContents !== undefined) {
			const contents = pendingContents;
			pendingContents = undefined;

			onResult(await save(contents));
		}
	};

	const startWriting = (): Promise<void> => {
		if(writeInFlight) {
			return writeInFlight;
		}

		writeInFlight = drain().finally(() => {
			writeInFlight = undefined;
		});

		return writeInFlight;
	};

	// A write already in flight has to finish before the one this is about, and a change that arrived during it is picked up by
	// the same drain rather than by a second one
	const writeEverythingPending = async(): Promise<void> => {
		cancelTimer();
		await writeInFlight;
		await startWriting();
	};

	return {
		schedule: (contents) => {
			pendingContents = contents;
			cancelTimer();
			timerHandle = setTimer(() => {
				timerHandle = undefined;
				void startWriting();
			}, debounceMs);
		},
		flush: writeEverythingPending,
		saveNow: (contents) => {
			pendingContents = contents;

			return writeEverythingPending();
		},
		hasPendingChanges: () => {
			return pendingContents !== undefined || writeInFlight !== undefined;
		}
	};
};
