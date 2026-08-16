import { createTranslationContext } from 'src/framework/renderer/TranslationContext';
import { createSpiccioliTranslator, resolveSpiccioliLanguage } from 'src/i18n/Translations';

// The renderer takes the language the browser reports, which in Electron is the one the operating system is set to
const getRequestedLanguages = (): readonly string[] => {
	return typeof navigator === 'undefined' ? [] : [ ...navigator.languages ];
};

const { TranslationProvider, useTranslator, useLanguage } = createTranslationContext({
	createTranslator: createSpiccioliTranslator,
	initialLanguage: resolveSpiccioliLanguage(getRequestedLanguages())
});

export { TranslationProvider, useTranslator, useLanguage };
