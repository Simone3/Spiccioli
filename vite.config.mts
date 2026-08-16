import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The config is loaded as a real ES module, which has no "__dirname"
const CONFIG_DIRECTORY = import.meta.dirname;

// Electron loads the built "index.html" from disk in development and packaged alike, so asset URLs must stay relative
const RELATIVE_ASSET_BASE = './';

// The React sources import each other through absolute "src/..." specifiers, which Vite resolves through this alias
const SOURCE_ALIAS = {
	src: path.resolve(CONFIG_DIRECTORY, 'src')
};

// The output folder is the one the Electron main process and the packaging step already expect
const REACT_BUILD_DIRECTORY = 'build';

// The renderer only ever runs in the Chromium that Electron bundles, so the output is not downlevelled for other browsers.
// This replaces the browser list that Create React App used to read from "package.json".
const ELECTRON_CHROMIUM_TARGET = 'chrome150';

// The Content-Security-Policy the development server needs on top of the one "index.html" ships: React Fast Refresh installs its runtime
// through an inline module script, and the hot update channel is a WebSocket back to the development server
const DEVELOPMENT_CONTENT_SECURITY_POLICY = 'default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; connect-src \'self\' ws://localhost:* ws://127.0.0.1:*';

const CONTENT_SECURITY_POLICY_META_PATTERN = /(<meta\s+http-equiv="(?:X-)?Content-Security-Policy"\s+content=")[^"]*(")/g;

// Relaxes the policy for the page the development server serves and for that page only, so the built "index.html" keeps the strict one it
// is packaged with. It fails loudly instead of quietly serving a page the browser will block, because the two policies live in different
// files and nothing else would notice them drifting apart.
const developmentContentSecurityPolicy = (): Plugin => {
	return {
		name: 'spiccioli-development-content-security-policy',
		apply: 'serve',
		transformIndexHtml: (html: string): string => {
			const relaxedHtml = html.replace(CONTENT_SECURITY_POLICY_META_PATTERN, `$1${DEVELOPMENT_CONTENT_SECURITY_POLICY}$2`);

			if(relaxedHtml === html) {
				throw new Error('No Content-Security-Policy meta tag was found in the renderer HTML: the development server would serve a page whose policy blocks hot reloading');
			}

			return relaxedHtml;
		}
	};
};

export default defineConfig({
	plugins: [ react(), developmentContentSecurityPolicy() ],
	base: RELATIVE_ASSET_BASE,
	resolve: {
		alias: SOURCE_ALIAS
	},
	build: {
		outDir: REACT_BUILD_DIRECTORY,
		emptyOutDir: true,
		target: ELECTRON_CHROMIUM_TARGET
	},
	test: {
		globals: true,
		environment: 'jsdom',
		include: [ 'tests/**/*.{test,spec}.{ts,tsx}' ],
		setupFiles: [ 'tests/setupTests.ts' ]
	}
});
