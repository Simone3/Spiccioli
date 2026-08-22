import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { TranslationProvider } from 'src/i18n/TranslationContext';
import { createSpiccioliTranslator, type SpiccioliTranslator } from 'src/i18n/Translations';
import { createFormatter, type Formatter } from 'src/logic/format/Formatter';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';

/**
 * A translator in the language the assertions are written in.
 * Tests assert on English wording on purpose: it is the bundle that defines the keys, so a key that stops existing has to fail somewhere.
 * @returns The English translator.
 */
export const makeTranslator = (): SpiccioliTranslator => {
	return createSpiccioliTranslator('en');
};

/**
 * A formatter on the preferences a fresh installation runs with, which write a thousand as "1.000" and a cent as ",50".
 * @returns The formatter.
 */
export const makeFormatter = (): Formatter => {
	return createFormatter(DEFAULT_PREFERENCES);
};

/**
 * Renders inside the translation provider, which every component that shows text needs above it.
 * It is passed as a wrapper rather than wrapped around the element, so that "rerender" keeps the provider in place.
 * @param ui Element to render.
 * @param options Render options, minus the wrapper this helper supplies.
 * @returns The render result.
 */
export const renderWithTranslations = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult => {
	return render(ui, { ...options, wrapper: TranslationProvider });
};
