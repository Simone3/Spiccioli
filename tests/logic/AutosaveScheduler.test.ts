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

	test('flushing with nothing waiting writes nothing', async() => {
		const written: string[] = [];
		const scheduler = createAutosaveScheduler<void>({
			debounceMs: DEBOUNCE_MS,
			save: (contents) => {
				written.push(contents);

				return Promise.resolve();
			},
			onResult: () => {
				return undefined;
			}
		});

		await scheduler.flush();

		expect(written).toEqual([]);
	});
});
