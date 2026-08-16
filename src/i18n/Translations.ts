import { I18N_CONFIG } from 'src/config/AppConfig';
import { resolveLanguage } from 'src/framework/i18n/LanguageResolution';
import { createTranslator } from 'src/framework/i18n/Translator';
import { EN_TRANSLATIONS } from 'src/i18n/lang/en';
import type { TranslationKey, Translator } from 'src/framework/types/TranslationTypes';

/**
 * The one place a language is turned into wording.
 * This module is imported by the Electron main process as well as the renderer, so it holds no React and no Electron: each
 * process asks for the language it resolved and gets a translator back.
 *
 * Spiccioli ships one bundle and offers no language selector, so the resolution below always lands on English today. It is kept
 * because the requirement is that a second language must not be a rewrite: adding one is writing its bundle and listing it here.
 */

// English is the source of truth for the key type: every other bundle has to match its shape, so a key can never exist in one language only
export type SpiccioliTranslations = typeof EN_TRANSLATIONS;

export type SpiccioliTranslationKey = TranslationKey<SpiccioliTranslations>;

export type SpiccioliTranslator = Translator<SpiccioliTranslations>;

// A language is added by writing its bundle next to "lang/en.ts" and listing it here. Typing the values as the English
// bundle is what makes an incomplete translation a compile error rather than a key showing up on screen.
const TRANSLATION_BUNDLES: Record<string, SpiccioliTranslations> = {
	en: EN_TRANSLATIONS
};

export const AVAILABLE_LANGUAGES: readonly string[] = Object.keys(TRANSLATION_BUNDLES);

/**
 * Picks the language Spiccioli runs in.
 * @param requestedLanguages What the runtime asks for, best match first. The main process reads this from Electron and the renderer from the browser.
 * @returns One of the available languages, always.
 */
export const resolveSpiccioliLanguage = (requestedLanguages: readonly string[]): string => {
	return resolveLanguage({
		requestedLanguages,
		availableLanguages: AVAILABLE_LANGUAGES,
		fallbackLanguage: I18N_CONFIG.defaultLanguage
	});
};

/**
 * Creates the translator for a language.
 * @param language Language to translate into. An unknown one falls back to the default language.
 * @returns A translator bound to that language.
 */
export const createSpiccioliTranslator = (language: string): SpiccioliTranslator => {
	const translations = TRANSLATION_BUNDLES[language] ?? EN_TRANSLATIONS;

	return createTranslator({
		language,
		translations,

		// A bundle that is not translated all the way through shows English rather than showing the reader a key
		fallbackTranslations: EN_TRANSLATIONS,
		onMissingTranslation: (key) => {
			console.warn('Missing translation', { language, key });
		}
	});
};
