import type { TranslationTree } from 'src/framework/types/TranslationTypes';

/**
 * Every word Spiccioli shows the user, in English.
 * This bundle is the source of truth for the key type, so a key added here has to be translated in every other language
 * before that language compiles, and a key renamed here stops compiling everywhere it is used.
 *
 * It is imported by the Electron main process as well as the renderer, so it must stay free of Node, Electron and React imports.
 */
export const EN_TRANSLATIONS = {
	app: {
		name: 'Spiccioli'
	},

	// The placeholder page, which goes away with the launch screen of the functional analysis
	placeholder: {
		title: 'Spiccioli',
		message: 'The scaffolding is in place: this page is served by Vite, drawn by React and rendered inside Electron.',
		environment: 'Version {version} on {platform}',
		environmentUnavailable: 'The main process did not answer.'
	},

	// The two crash screens: the one the renderer draws over itself, and the dialog the main process opens when it has no window to draw in
	crash: {
		title: 'Something went wrong',
		message: 'Spiccioli could not draw this screen. Reloading starts over from the data on disk.',
		reload: 'Reload',
		mainProcessTitle: 'Spiccioli stopped working',
		mainProcessMessage: 'Spiccioli ran into a problem it could not recover from:\n\n{message}'
	}
} as const satisfies TranslationTree;
