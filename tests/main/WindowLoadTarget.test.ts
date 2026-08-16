import path from 'node:path';
import { WINDOW_CONFIG } from 'src/config/AppConfig';
import { isDevelopmentRun, REACT_BUILD_INDEX_RELATIVE_PATH, resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';

const BUILT_INDEX_TARGET = {
	type: 'file',
	value: path.join('/app/root', REACT_BUILD_INDEX_RELATIVE_PATH)
};

describe('WindowLoadTarget', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	test('uses the built React index file from the app root', () => {
		expect(resolveWindowLoadTarget({
			appRootDirectory: '/app/root',
			isPackaged: false
		})).toEqual(BUILT_INDEX_TARGET);
	});

	test('uses the development server a development run was started with', () => {
		vi.stubEnv(WINDOW_CONFIG.developmentServerUrlVariable, 'http://localhost:5173/');

		expect(resolveWindowLoadTarget({
			appRootDirectory: '/app/root',
			isPackaged: false
		})).toEqual({
			type: 'url',
			value: 'http://localhost:5173/'
		});
	});

	test('ignores the development server variable in a packaged run', () => {
		vi.stubEnv(WINDOW_CONFIG.developmentServerUrlVariable, 'http://localhost:5173/');

		expect(resolveWindowLoadTarget({
			appRootDirectory: '/app/root',
			isPackaged: true
		})).toEqual(BUILT_INDEX_TARGET);
	});

	// The development run is read back from the resolved target, so the refusal above decides it too: a packaged run is never one
	describe('isDevelopmentRun', () => {
		test('recognizes the run that loads the renderer from the development server', () => {
			expect(isDevelopmentRun({
				type: 'url',
				value: 'http://localhost:5173/'
			})).toBe(true);
		});

		test('does not recognize the run that loads the built renderer', () => {
			expect(isDevelopmentRun({
				type: 'file',
				value: '/app/root/build/index.html'
			})).toBe(false);
		});
	});
});
