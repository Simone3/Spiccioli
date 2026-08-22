import type { PluralTranslation, TranslationKey, TranslationLeaf, TranslationParameters, TranslationTree, Translator } from 'src/framework/types/TranslationTypes';

export interface CreateTranslatorOptions<TTranslations extends TranslationTree> {
	language: string;
	translations: TTranslations;

	// Left undefined to format numbers, lists and plural categories with the language itself, which is what an application
	// that ships one bundle per language wants. A regional locale is passed in only when the two have to differ.
	locale?: string;

	// A bundle that is not translated all the way through falls back to this one, so a key that is missing shows the
	// default language instead of showing the reader a key
	fallbackTranslations?: TranslationTree;

	// Called with any key no bundle could resolve, so an application can report it instead of failing silently
	onMissingTranslation?: (key: string) => void;

	// How a number interpolated into a sentence is written. Left undefined to write it the way the locale writes one, which is
	// what an application with no formatting rules of its own wants; supplied by an application that fixes its own separators,
	// so that a figure inside a sentence and the same figure beside it cannot disagree.
	formatNumber?: (value: number) => string;
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

// A plain enumeration, joined the way the locale joins one. "unit" is what leaves out the trailing conjunction, which belongs
// to a sentence and not to a list of independent fragments. "narrow" would drop the separator itself, which is not wanted.
const LIST_FORMAT: Intl.ListFormatOptions = {
	style: 'long',
	type: 'unit'
};

// Building an Intl object costs far more than using one, and these format once per rendered string, so they are memoized by locale.
// Nothing can observe the difference, because every one of them is immutable and depends on the locale alone.
const pluralRulesCache = new Map<string, Intl.PluralRules>();
const ordinalRulesCache = new Map<string, Intl.PluralRules>();
const listFormatCache = new Map<string, Intl.ListFormat>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

const getFromCache = <TFormatter>(cache: Map<string, TFormatter>, locale: string, create: () => TFormatter): TFormatter => {
	const cachedFormatter = cache.get(locale);

	if(cachedFormatter) {
		return cachedFormatter;
	}

	const formatter = create();
	cache.set(locale, formatter);

	return formatter;
};

const isPluralTranslation = (leaf: TranslationLeaf | TranslationTree): leaf is PluralTranslation => {
	return typeof leaf === 'object' && typeof (leaf as PluralTranslation).other === 'string';
};

/**
 * Walks a dotted key down a bundle.
 * @param translations Bundle to read.
 * @param key Dotted key path.
 * @returns The leaf the key names, or undefined when the bundle does not have it.
 */
const resolveLeaf = (translations: TranslationTree, key: string): TranslationLeaf | undefined => {
	let node: TranslationLeaf | TranslationTree | undefined = translations;

	for(const keySegment of key.split('.')) {
		if(typeof node !== 'object' || isPluralTranslation(node)) {
			return undefined;
		}

		node = node[keySegment];
	}

	if(typeof node === 'string' || (node !== undefined && isPluralTranslation(node))) {
		return node;
	}

	return undefined;
};

// Creates a translator over one bundle. The application decides which language that is and which bundle belongs to it, so the
// framework never has to know either.
export const createTranslator = <TTranslations extends TranslationTree>({
	language,
	translations,
	locale = language,
	fallbackTranslations,
	onMissingTranslation,
	formatNumber
}: CreateTranslatorOptions<TTranslations>): Translator<TTranslations> => {
	const formatNumberInLocale = (value: number): string => {
		return getFromCache(numberFormatCache, locale, () => {
			return new Intl.NumberFormat(locale);
		}).format(value);
	};

	const writeNumber = formatNumber ?? formatNumberInLocale;

	// A count of 1 is not "one" in every language, and no language has the same categories as the next, so the category is
	// never guessed from the number: Intl is what knows which one a count falls into
	const selectPluralForm = (plural: PluralTranslation, parameters: TranslationParameters | undefined): string => {
		const count = parameters?.count;

		if(typeof count !== 'number') {
			return plural.other;
		}

		const category = getFromCache(pluralRulesCache, locale, () => {
			return new Intl.PluralRules(locale);
		}).select(count);

		return plural[category] ?? plural.other;
	};

	// A placeholder with nothing to fill it is left as it is, so a bundle that asks for a value the caller did not pass shows up
	// instead of quietly turning into an empty gap in the sentence
	const interpolate = (text: string, parameters: TranslationParameters | undefined): string => {
		if(!parameters) {
			return text;
		}

		return text.replace(PLACEHOLDER_PATTERN, (placeholder, parameterName: string) => {
			const value = parameters[parameterName];

			if(value === undefined) {
				return placeholder;
			}

			return typeof value === 'number' ? writeNumber(value) : value;
		});
	};

	const t = (key: TranslationKey<TTranslations>, parameters?: TranslationParameters): string => {
		const leaf = resolveLeaf(translations, key) ?? (fallbackTranslations && resolveLeaf(fallbackTranslations, key));

		if(leaf === undefined) {
			onMissingTranslation?.(key);

			return key;
		}

		return interpolate(typeof leaf === 'string' ? leaf : selectPluralForm(leaf, parameters), parameters);
	};

	// Which suffix a position takes is not which form a count takes — English writes "one item" but "1st", "2nd" and "21st" — so
	// a bundle spells the suffixes out and this is what picks between them
	const selectOrdinal = (position: number): Intl.LDMLPluralRule => {
		return getFromCache(ordinalRulesCache, locale, () => {
			return new Intl.PluralRules(locale, { type: 'ordinal' });
		}).select(position);
	};

	const formatList = (values: string[]): string => {
		return getFromCache(listFormatCache, locale, () => {
			return new Intl.ListFormat(locale, LIST_FORMAT);
		}).format(values);
	};

	return {
		language,
		locale,
		t,
		selectOrdinal,
		formatList
	};
};
