import { installWindowNavigationGuard, isAllowedNavigationUrl, type GuardedWebContents } from 'src/framework/main/window/WindowNavigationGuard';

const ALLOWED_FILE_URL = 'file:///Applications/App.app/Contents/Resources/app.asar/build/index.html';

const ALLOWED_SERVER_URL = 'http://localhost:5173/';

interface FakeWebContents {
	webContents: GuardedWebContents;
	navigateTo: (url: string) => boolean;
	openWindow: (url: string) => { action: string };
}

// Only the two hooks the guard installs, so a test can drive them without an Electron window
const createFakeWebContents = (): FakeWebContents => {
	let navigationListener: ((event: { preventDefault: () => void }, url: string) => void) | undefined;
	let windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;

	const webContents = {
		on: (event: string, listener: (event: { preventDefault: () => void }, url: string) => void) => {
			if(event === 'will-navigate') {
				navigationListener = listener;
			}
		},
		setWindowOpenHandler: (handler: (details: { url: string }) => { action: string }) => {
			windowOpenHandler = handler;
		}
	} as unknown as GuardedWebContents;

	return {
		webContents,

		// Returns whether the navigation was prevented
		navigateTo: (url) => {
			let wasPrevented = false;

			navigationListener?.({
				preventDefault: () => {
					wasPrevented = true;
				}
			}, url);

			return wasPrevented;
		},
		openWindow: (url) => {
			return windowOpenHandler?.({ url }) ?? { action: 'none' };
		}
	};
};

describe('isAllowedNavigationUrl', () => {
	test('allows the built renderer file the window was loaded with', () => {
		expect(isAllowedNavigationUrl(ALLOWED_FILE_URL, ALLOWED_FILE_URL)).toBe(true);
	});

	test('blocks another file on disk', () => {
		expect(isAllowedNavigationUrl('file:///Users/someone/elsewhere.html', ALLOWED_FILE_URL)).toBe(false);
	});

	test('allows any path of the development server, which reloads the renderer at paths of its own', () => {
		expect(isAllowedNavigationUrl('http://localhost:5173/src/index.tsx', ALLOWED_SERVER_URL)).toBe(true);
	});

	test('blocks another origin than the development server', () => {
		expect(isAllowedNavigationUrl('http://localhost:5174/', ALLOWED_SERVER_URL)).toBe(false);
		expect(isAllowedNavigationUrl('http://example.com/', ALLOWED_SERVER_URL)).toBe(false);
	});

	test('blocks a remote page while the renderer is loaded from disk', () => {
		expect(isAllowedNavigationUrl('https://example.com/', ALLOWED_FILE_URL)).toBe(false);
	});

	test('blocks a URL that cannot be parsed', () => {
		expect(isAllowedNavigationUrl('not a url', ALLOWED_FILE_URL)).toBe(false);
	});
});

describe('installWindowNavigationGuard', () => {
	test('lets the window stay on the page it was loaded with', () => {
		const onNavigationBlocked = vi.fn();
		const fake = createFakeWebContents();

		installWindowNavigationGuard({
			webContents: fake.webContents,
			allowedUrl: ALLOWED_FILE_URL,
			onNavigationBlocked
		});

		expect(fake.navigateTo(ALLOWED_FILE_URL)).toBe(false);
		expect(onNavigationBlocked).not.toHaveBeenCalled();
	});

	test('prevents a navigation away from that page and reports it', () => {
		const onNavigationBlocked = vi.fn();
		const fake = createFakeWebContents();

		installWindowNavigationGuard({
			webContents: fake.webContents,
			allowedUrl: ALLOWED_FILE_URL,
			onNavigationBlocked
		});

		expect(fake.navigateTo('https://example.com/')).toBe(true);
		expect(onNavigationBlocked).toHaveBeenCalledWith('https://example.com/');
	});

	test('denies every window the page tries to open and reports it', () => {
		const onNavigationBlocked = vi.fn();
		const fake = createFakeWebContents();

		installWindowNavigationGuard({
			webContents: fake.webContents,
			allowedUrl: ALLOWED_FILE_URL,
			onNavigationBlocked
		});

		expect(fake.openWindow('https://example.com/')).toEqual({ action: 'deny' });
		expect(onNavigationBlocked).toHaveBeenCalledWith('https://example.com/');
	});

	test('works without anything to report to', () => {
		const fake = createFakeWebContents();

		installWindowNavigationGuard({
			webContents: fake.webContents,
			allowedUrl: ALLOWED_FILE_URL
		});

		expect(fake.navigateTo('https://example.com/')).toBe(true);
		expect(fake.openWindow('https://example.com/')).toEqual({ action: 'deny' });
	});
});
