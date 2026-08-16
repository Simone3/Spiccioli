import path from 'node:path';
import { resolveWindowLoadTarget } from 'src/framework/main/window/WindowLoadTarget';

describe('WindowLoadTarget', () => {
	test('uses the built renderer index file from the app root', () => {
		expect(resolveWindowLoadTarget({
			appRootDirectory: '/app/root',
			rendererIndexPathSegments: [ 'build', 'index.html' ]
		})).toEqual({
			type: 'file',
			value: path.join('/app/root', 'build', 'index.html')
		});
	});

	test('uses the development server when one is running', () => {
		expect(resolveWindowLoadTarget({
			appRootDirectory: '/app/root',
			rendererIndexPathSegments: [ 'build', 'index.html' ],
			developmentServerUrl: 'http://localhost:5173/'
		})).toEqual({
			type: 'url',
			value: 'http://localhost:5173/'
		});
	});

	test('falls back to the built renderer index file when the development server URL is empty', () => {
		expect(resolveWindowLoadTarget({
			appRootDirectory: '/app/root',
			rendererIndexPathSegments: [ 'build', 'index.html' ],
			developmentServerUrl: ''
		})).toEqual({
			type: 'file',
			value: path.join('/app/root', 'build', 'index.html')
		});
	});
});
