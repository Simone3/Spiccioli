import { createAutosaveScheduler } from 'src/logic/storage/AutosaveScheduler';

const DEBOUNCE_MS = 2000;

// A save that resolves when the test says so, so that a change arriving mid-write can be arranged
const makeControllableSave = (): {
	save: (contents: string) => Promise<string>;
	written: string[];
	settleNext: () => void;
} => {
	const written: string[] = [];
	const pending: (() => void)[] = [];

	return {
		written,
		save: (contents) => {
			written.push(contents);

			return new Promise((resolve) => {
				pending.push(() => {
					resolve(contents);
				});
			});
		},
		settleNext: () => {
			pending.shift()?.();
		}
	};
};

describe('the autosave', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('writes nothing until the wait is over', async() => {
		const written: string[] = [];
		const scheduler = createAutosaveScheduler<void>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				written.push(contents);

				return Promise.resolve();
			},
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: () => {
				return undefined;
			}
		});

		scheduler.schedule('first');
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
		expect(written).toEqual([]);

		await vi.advanceTimersByTimeAsync(1);
		expect(written).toEqual([ 'first' ]);
	});

	test('collapses a burst of changes into one write of the newest', async() => {
		const written: string[] = [];
		const scheduler = createAutosaveScheduler<void>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				written.push(contents);

				return Promise.resolve();
			},
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: () => {
				return undefined;
			}
		});

		scheduler.schedule('first');
		await vi.advanceTimersByTimeAsync(500);
		scheduler.schedule('second');
		await vi.advanceTimersByTimeAsync(500);
		scheduler.schedule('third');
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

		expect(written).toEqual([ 'third' ]);
	});

	test('never lets two writes overlap', async() => {
		const controllable = makeControllableSave();
		const scheduler = createAutosaveScheduler<string>({
			debounceMs: DEBOUNCE_MS,
			save: controllable.save,
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: () => {
				return undefined;
			}
		});

		scheduler.schedule('first');
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(controllable.written).toEqual([ 'first' ]);

		// A change made while the first write is still in flight waits for it rather than racing it for the same file
		scheduler.schedule('second');
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(controllable.written).toEqual([ 'first' ]);

		controllable.settleNext();
		await vi.advanceTimersByTimeAsync(0);
		expect(controllable.written).toEqual([ 'first', 'second' ]);
	});

	test('flushes what is waiting without waiting out the debounce', async() => {
		const written: string[] = [];
		const scheduler = createAutosaveScheduler<void>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				written.push(contents);

				return Promise.resolve();
			},
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: () => {
				return undefined;
			}
		});

		scheduler.schedule('pending');
		await scheduler.flush();

		expect(written).toEqual([ 'pending' ]);
		expect(scheduler.hasPendingChanges()).toBe(false);
	});

	test('reports the outcome of every write it makes', async() => {
		const results: string[] = [];
		const scheduler = createAutosaveScheduler<string>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				return Promise.resolve(`saved ${contents}`);
			},
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: (result) => {
				results.push(result);
			}
		});

		scheduler.schedule('first');
		await scheduler.flush();
		scheduler.schedule('second');
		await scheduler.flush();

		expect(results).toEqual([ 'saved first', 'saved second' ]);
	});

	/**
	 * The blocking write-failure message's own *Retry* is this, and it has to be: a save of its own would be a second writer on
	 * one file, and the two of them fill the same temporary file and rename a splice of both onto the ledger.
	 */
	test('saving now waits for the write in flight instead of starting a second one', async() => {
		const { save, written, settleNext } = makeControllableSave();
		const scheduler = createAutosaveScheduler<string>({
			debounceMs: DEBOUNCE_MS,
			save,
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: () => {
				return undefined;
			}
		});

		scheduler.schedule('first');
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

		expect(written).toEqual([ 'first' ]);

		const retried = scheduler.saveNow('retried');

		// Nothing new goes out while the first one is still running
		expect(written).toEqual([ 'first' ]);

		settleNext();
		await vi.advanceTimersByTimeAsync(0);

		expect(written).toEqual([ 'first', 'retried' ]);

		settleNext();
		await retried;
	});

	test('saving now with nothing in flight writes straight away', async() => {
		const written: string[] = [];
		const scheduler = createAutosaveScheduler<void>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				written.push(contents);

				return Promise.resolve();
			},
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: () => {
				return undefined;
			}
		});

		await scheduler.saveNow('retried');

		expect(written).toEqual([ 'retried' ]);
	});

	/**
	 * The contents leave the queue before they are attempted, so a save that rejects rather than reporting a failure has taken
	 * them with it. Nothing would be pending and nothing would have failed, and that is exactly the state a close reads as "the
	 * file has everything" — so it would end the session over changes that never reached the disk.
	 */
	test('reports a save that rejected as a failed write rather than losing it', async() => {
		const results: string[] = [];
		const scheduler = createAutosaveScheduler<string>({
			debounceMs: DEBOUNCE_MS,
			save: () => {
				return Promise.reject(new Error('the bridge went away'));
			},
			onSaveRejected: (error) => {
				return `failed: ${(error as Error).message}`;
			},
			onResult: (result) => {
				results.push(result);
			}
		});

		scheduler.schedule('unwritten');
		await scheduler.flush();

		expect(results).toEqual([ 'failed: the bridge went away' ]);
		expect(scheduler.hasPendingChanges()).toBe(false);
	});

	test('goes on writing after a save that rejected', async() => {
		const results: string[] = [];
		let shouldReject = true;
		const scheduler = createAutosaveScheduler<string>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				if(shouldReject) {
					return Promise.reject(new Error('gone'));
				}

				return Promise.resolve(`saved ${contents}`);
			},
			onSaveRejected: () => {
				return 'failed';
			},
			onResult: (result) => {
				results.push(result);
			}
		});

		scheduler.schedule('first');
		await scheduler.flush();

		shouldReject = false;
		scheduler.schedule('second');
		await scheduler.flush();

		expect(results).toEqual([ 'failed', 'saved second' ]);
	});

	test('flushing with nothing waiting writes nothing', async() => {
		const written: string[] = [];
		const scheduler = createAutosaveScheduler<void>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				written.push(contents);

				return Promise.resolve();
			},
			onSaveRejected: (error) => {
				throw error;
			},
			onResult: () => {
				return undefined;
			}
		});

		await scheduler.flush();

		expect(written).toEqual([]);
	});
});
