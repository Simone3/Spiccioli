/**
 * The shape a translation bundle has to have, and the types that derive typed keys out of one.
 * A bundle is a tree of nested groups whose leaves are either one string or one string per plural category.
 * The application owns the wording and the tree, so the framework only fixes what a bundle may contain.
 */

// Every plural category Intl knows about. Only "other" is required, because it is the only one every language has.
export type PluralTranslation = Partial<Record<Intl.LDMLPluralRule, string>> & {
	other: string;
};

export type TranslationLeaf = string | PluralTranslation;

export interface TranslationTree {
	[key: string]: TranslationLeaf | TranslationTree;
}

// Values interpolated into a translation through "{name}" placeholders. "count" is also what picks the category of a plural leaf.
export type TranslationParameters = Record<string, string | number>;

/**
 * Every dotted path that leads to a leaf of the given bundle, so a key that does not exist cannot be asked for and a
 * key that is renamed in the bundle stops compiling everywhere it is used.
 */
export type TranslationKey<TTranslations> = {
	[TKey in keyof TTranslations & string]: TTranslations[TKey] extends TranslationLeaf ?
		TKey :
		`${TKey}.${TranslationKey<TTranslations[TKey]>}`;
}[keyof TTranslations & string];

/**
 * Reads wording out of one bundle, in one language.
 * Everything that formats is driven by the same locale, so a translated string and the numbers and lists inside it can never disagree.
 */
export interface Translator<TTranslations> {
	language: string;
	locale: string;

	// Returns the wording for a key, with "{name}" placeholders replaced and the plural category picked from "count"
	t: (key: TranslationKey<TTranslations>, parameters?: TranslationParameters) => string;

	// The category a position falls into as an ordinal, which is what a bundle writing "1st", "2nd" and "3rd" picks its wording by
	selectOrdinal: (position: number) => Intl.LDMLPluralRule;

	// Joins already translated fragments the way the locale joins a plain enumeration
	formatList: (values: string[]) => string;
}
