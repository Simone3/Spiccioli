import type { WebContents } from 'electron';

/**
 * Keeps a window on the page the application loaded into it.
 *
 * A Content-Security-Policy restricts what a page may load, but not where the page itself may go: a link, a script or an embedded
 * editor can still navigate the whole renderer somewhere else, or open a second window, and that page would sit behind the same
 * preload bridge as the application. Both are refused here instead, so the only page that ever reaches the bridge is the one the
 * main process chose.
 */

export type GuardedWebContents = Pick<WebContents, 'on' | 'setWindowOpenHandler'>;

export interface InstallWindowNavigationGuardOptions {
	webContents: GuardedWebContents;

	// The page the window is allowed to be on, as a URL. A file target is given as its "file://" URL, not as a path.
	allowedUrl: string;

	// Called with every navigation and every window that was refused, for the application to leave a trace of
	onNavigationBlocked?: (url: string) => void;
}

const parseUrl = (url: string): URL | undefined => {
	try {
		return new URL(url);
	}
	catch {
		return undefined;
	}
};

/**
 * Decides whether a window may navigate to a URL.
 * A development server serves the renderer over HTTP and reloads it at paths of its own, so any page of that same origin is allowed.
 * A built renderer is one file, and every "file://" URL shares the same opaque origin, so that one is matched on its path instead.
 * @param targetUrl Where the window is trying to go.
 * @param allowedUrl The page the window is allowed to be on.
 * @returns Whether the navigation may proceed.
 */
export const isAllowedNavigationUrl = (targetUrl: string, allowedUrl: string): boolean => {
	const target = parseUrl(targetUrl);
	const allowed = parseUrl(allowedUrl);

	if(!target || !allowed || target.protocol !== allowed.protocol) {
		return false;
	}

	if(target.protocol === 'file:') {
		return target.pathname === allowed.pathname;
	}

	return target.origin === allowed.origin;
};

export const installWindowNavigationGuard = ({
	webContents,
	allowedUrl,
	onNavigationBlocked
}: InstallWindowNavigationGuardOptions): void => {
	// Nothing in the application opens a second window, so every request for one is something the page decided on its own
	webContents.setWindowOpenHandler(({ url }) => {
		onNavigationBlocked?.(url);

		return { action: 'deny' };
	});

	// Only whole-page navigations arrive here. A router that moves through the fragment stays on the same document and never
	// reaches this event, so client-side routing is unaffected.
	webContents.on('will-navigate', (event, url) => {
		if(isAllowedNavigationUrl(url, allowedUrl)) {
			return;
		}

		event.preventDefault();
		onNavigationBlocked?.(url);
	});
};
