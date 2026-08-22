import { type ReactElement, type ReactNode } from 'react';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { createTranslationContext } from 'src/framework/renderer/TranslationContext';
import { createSpiccioliTranslator, resolveSpiccioliLanguage } from 'src/i18n/Translations';

// The renderer takes the language the browser reports, which in Electron is the one the operating system is set to
const getRequestedLanguages = (): readonly string[] => {
	return typeof navigator === 'undefined' ? [] : [ ...navigator.languages ];
};

// The language every translator in the renderer is built for. It is resolved once, at load, because nothing changes it: Spiccioli
// ships one bundle and offers no language selector.
export const RENDERER_LANGUAGE = resolveSpiccioliLanguage(getRequestedLanguages());

const { TranslationProvider: FrameworkTranslationProvider, useTranslator, useLanguage } = createTranslationContext({
	createTranslator: createSpiccioliTranslator,
	initialLanguage: RENDERER_LANGUAGE
});

/**
 * Provides the wording, with every number inside it written the way the preferences write a figure.
 *
 * **It is mounted inside the preferences and not above them.** A count in a sentence and an amount in the column beside it are
 * the same figure to the reader, so both are written by the one formatter the preferences define — which means the translator is
 * rebuilt when a separator changes, and every sentence on screen is redrawn with it.
 * @param props The provider's props.
 * @param props.children The tree that reads the wording.
 * @returns The provider.
 */
export const TranslationProvider = ({ children }: { children: ReactNode }): ReactElement => {
	const formatter = useFormatter();

	return (
		<FrameworkTranslationProvider formatNumber={formatter.integer}>
			{children}
		</FrameworkTranslationProvider>
	);
};

export { useTranslator, useLanguage };
