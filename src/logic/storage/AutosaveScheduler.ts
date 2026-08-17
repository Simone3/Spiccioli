/**
 * Autosave, debounced.
 *
 * Every change to the model schedules a write, and a write that is already scheduled is pushed back rather than added to: what
 * reaches the file is the state after the last keystroke, not one file per keystroke. Only the newest contents are ever kept,
 * so a burst of edits costs one write.
 *
 * **Writes never overlap.** A change made while a write is in flight is written after it finishes, which matters because a
 * failing write is being retried for up to fifteen seconds behind this and a second write starting inside that window would be
 * racing it for the same file.
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

	return {
		schedule: (contents) => {
			pendingContents = contents;
			cancelTimer();
			timerHandle = setTimer(() => {
				timerHandle = undefined;
				void startWriting();
			}, debounceMs);
		},
		flush: async() => {
			cancelTimer();

			// A write already in flight has to finish before the one this flush is about, and a change that arrived during it is
			// picked up by the same drain rather than by a second one
			await writeInFlight;
			await startWriting();
		},
		hasPendingChanges: () => {
			return pendingContents !== undefined || writeInFlight !== undefined;
		}
	};
};
