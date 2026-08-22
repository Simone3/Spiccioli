import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { PreferencesProvider } from 'src/contexts/PreferencesContext';
import { TranslationProvider } from 'src/i18n/TranslationContext';
import { createSpiccioliTranslator, type SpiccioliTranslator } from 'src/i18n/Translations';
import { createFormatter, type Formatter } from 'src/logic/format/Formatter';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';

/**
 * A formatter on the preferences a fresh installation runs with, which write a thousand as "1.000" and a cent as ",50".
 * @returns The formatter.
 */
export const makeFormatter = (): Formatter => {
	return createFormatter(DEFAULT_PREFERENCES);
};

/**
 * A translator in the language the assertions are written in, writing a number inside a sentence the way the application writes
 * one: the renderer binds the formatter to the translator, so a test that did not would read separators no screen shows.
 * Tests assert on English wording on purpose: it is the bundle that defines the keys, so a key that stops existing has to fail somewhere.
 * @returns The English translator.
 */
export const makeTranslator = (): SpiccioliTranslator => {
	return createSpiccioliTranslator('en', makeFormatter().integer);
};

// The wording is provided inside the preferences, exactly as the real root mounts it: a number in a sentence is written by the
// formatter they define, so the two cannot be mounted the other way round
const TranslationTestProviders = ({ children }: { children: ReactNode }): ReactElement => {
	return (
		<PreferencesProvider>
			<TranslationProvider>{children}</TranslationProvider>
		</PreferencesProvider>
	);
};

/**
 * Renders inside the translation provider, which every component that shows text needs above it.
 * It is passed as a wrapper rather than wrapped around the element, so that "rerender" keeps the provider in place.
 * @param ui Element to render.
 * @param options Render options, minus the wrapper this helper supplies.
 * @returns The render result.
 */
export const renderWithTranslations = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult => {
	return render(ui, { ...options, wrapper: TranslationTestProviders });
};
