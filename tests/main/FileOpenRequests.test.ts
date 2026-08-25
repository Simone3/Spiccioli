import path from 'node:path';
import { createFileOpenRequests, type FileOpenPlatform, type FileOpenRequests } from 'src/main/startup/FileOpenRequests';

/**
 * A ledger a launch asked Spiccioli to open, held until the window takes it.
 *
 * Two rules are the whole of this: **asking for the file that is already open only brings the window forward**, which is what a
 * second launch on an open ledger has to do rather than close and re-read the session; and **taking clears**, which is what keeps
 * a renderer asking on mount and a renderer answering the event from opening one file twice between them.
 *
 * **The open file and every expectation are resolved by the host**, because that is what they are in the application: a session
 * holds the absolute path a dialog, the recent list or a take of this very request handed it, and the two sides of the comparison
 * are therefore both paths the platform made. Writing one of them out would leave a Windows host comparing a resolved path
 * against a shape no session ever holds.
 */

// The absolute path this host makes of one written the way these tests write them
const hostPath = (filePath: string): string => {
	return path.resolve(filePath);
};

interface RequestsHarness {
	requests: FileOpenRequests;
	openFilePath: { value: string | undefined };
	windowsBroughtForward: { value: number };
	filesWaiting: { value: number };
}

const makeHarness = (platform: FileOpenPlatform = 'linux'): RequestsHarness => {
	const openFilePath = { value: undefined as string | undefined };
	const windowsBroughtForward = { value: 0 };
	const filesWaiting = { value: 0 };

	return {
		requests: createFileOpenRequests({
			platform,
			getOpenFilePath: () => {
				return openFilePath.value;
			},
			bringWindowForward: () => {
				windowsBroughtForward.value += 1;
			},
			onFileWaiting: () => {
				filesWaiting.value += 1;
			}
		}),
		openFilePath,
		windowsBroughtForward,
		filesWaiting
	};
};

describe('FileOpenRequests', () => {
	test('holds the ledger a launch asked for until it is taken', () => {
		const harness = makeHarness();

		harness.requests.request({ filePath: '/Documents/finances.spiccioli', source: 'launch' });

		expect(harness.requests.take()).toBe(hostPath('/Documents/finances.spiccioli'));
	});

	test('answers one request once, so that nothing racing with the take opens it twice', () => {
		const harness = makeHarness();

		harness.requests.request({ filePath: '/Documents/finances.spiccioli', source: 'second-launch' });
		harness.requests.take();

		expect(harness.requests.take()).toBeUndefined();
	});

	test('has nothing waiting until a launch asks for something', () => {
		expect(makeHarness().requests.take()).toBeUndefined();
	});

	test('brings the window forward whatever the request turns out to be', () => {
		const harness = makeHarness();

		harness.openFilePath.value = hostPath('/Documents/finances.spiccioli');
		harness.requests.request({ filePath: '/Documents/finances.spiccioli', source: 'second-launch' });
		harness.requests.request({ filePath: '/Documents/other.spiccioli', source: 'second-launch' });

		expect(harness.windowsBroughtForward.value).toBe(2);
	});

	test('leaves the session alone when the ledger asked for is the one already open', () => {
		const harness = makeHarness();

		harness.openFilePath.value = hostPath('/Documents/finances.spiccioli');
		harness.requests.request({ filePath: '/Documents/finances.spiccioli', source: 'second-launch' });

		expect(harness.requests.take()).toBeUndefined();
		expect(harness.filesWaiting.value).toBe(0);
	});

	test('sends for the renderer only when there is something for it to take', () => {
		const harness = makeHarness();

		harness.requests.request({ filePath: '/Documents/finances.spiccioli', source: 'open-file-event' });
		harness.openFilePath.value = hostPath('/Documents/finances.spiccioli');
		harness.requests.request({ filePath: '/Documents/finances.spiccioli', source: 'open-file-event' });

		expect(harness.filesWaiting.value).toBe(1);
	});

	test('resolves the path it was handed', () => {
		const harness = makeHarness();

		harness.requests.request({ filePath: '/Documents/../Documents/finances.spiccioli', source: 'launch' });

		expect(harness.requests.take()).toBe(hostPath('/Documents/finances.spiccioli'));
	});

	test('replaces a ledger still waiting with the one asked for later', () => {
		const harness = makeHarness();

		harness.requests.request({ filePath: '/Documents/finances.spiccioli', source: 'launch' });
		harness.requests.request({ filePath: '/Documents/other.spiccioli', source: 'open-file-event' });

		expect(harness.requests.take()).toBe(hostPath('/Documents/other.spiccioli'));
	});

	// One file answers to several spellings on macOS and Windows, and to exactly one on Linux
	describe('the open file, on a platform that reads case', () => {
		test('is the same file however it is spelled on macOS', () => {
			const harness = makeHarness('darwin');

			harness.openFilePath.value = hostPath('/Documents/Finances.spiccioli');
			harness.requests.request({ filePath: '/documents/finances.SPICCIOLI', source: 'open-file-event' });

			expect(harness.requests.take()).toBeUndefined();
		});

		// Written with the separators of whatever host runs the tests, because resolving a path is the host's own job: what is
		// being tested here is the comparison the platform decides, not the shape of a Windows path
		test('is the same file however it is spelled on Windows', () => {
			const harness = makeHarness('win32');

			harness.openFilePath.value = hostPath('/Users/Me/finances.spiccioli');
			harness.requests.request({ filePath: '/users/me/Finances.spiccioli', source: 'second-launch' });

			expect(harness.requests.take()).toBeUndefined();
		});

		test('is another file where the case differs on Linux', () => {
			const harness = makeHarness('linux');

			harness.openFilePath.value = hostPath('/documents/Finances.spiccioli');
			harness.requests.request({ filePath: '/documents/finances.spiccioli', source: 'second-launch' });

			expect(harness.requests.take()).toBe(hostPath('/documents/finances.spiccioli'));
		});
	});
});
