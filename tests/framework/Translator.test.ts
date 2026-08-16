import { createTranslator } from 'src/framework/i18n/Translator';

const TRANSLATIONS = {
	plain: 'Plain text',
	group: {
		nested: 'Nested text',
		withParameters: 'Folder "{directory}" holds {count} copies',
		deeper: {
			leaf: 'Deep leaf'
		}
	},
	tasks: {
		one: '{count} task',
		other: '{count} tasks'
	},
	onlyOther: {
		other: 'always this one'
	},
	translatedOnlyHere: 'Only in the fallback'
} as const;

const createEnglishTranslator = (): ReturnType<typeof createTranslator<typeof TRANSLATIONS>> => {
	return createTranslator({
		language: 'en',
		translations: TRANSLATIONS
	});
};

describe('Translator', () => {
	test('reads a key at any depth', () => {
		const translator = createEnglishTranslator();

		expect(translator.t('plain')).toBe('Plain text');
		expect(translator.t('group.nested')).toBe('Nested text');
		expect(translator.t('group.deeper.leaf')).toBe('Deep leaf');
	});

	test('fills the placeholders it is given and leaves the ones it is not', () => {
		const translator = createEnglishTranslator();

		expect(translator.t('group.withParameters', { directory: '/tmp/backups', count: 3 })).toBe('Folder "/tmp/backups" holds 3 copies');
		expect(translator.t('group.withParameters', { directory: '/tmp/backups' })).toBe('Folder "/tmp/backups" holds {count} copies');
	});

	// Italian groups only from five digits up, which is exactly the kind of rule that makes pasting a raw number in wrong
	test('formats an interpolated number in the locale rather than pasting it in', () => {
		const english = createEnglishTranslator();
		const italian = createTranslator({ language: 'it', translations: TRANSLATIONS });

		expect(english.t('group.withParameters', { directory: 'd', count: 12345 })).toContain('12,345');
		expect(italian.t('group.withParameters', { directory: 'd', count: 12345 })).toContain('12.345');
		expect(italian.t('group.withParameters', { directory: 'd', count: 1234 })).toContain('1234');
	});

	test('picks the plural category from the count', () => {
		const translator = createEnglishTranslator();

		expect(translator.t('tasks', { count: 1 })).toBe('1 task');
		expect(translator.t('tasks', { count: 0 })).toBe('0 tasks');
		expect(translator.t('tasks', { count: 7 })).toBe('7 tasks');
	});

	// A count of 1 is "one" in English and a count of 2 is not "few", so a hand-written rule would get this wrong for both
	test('picks the plural category the language actually has, not the English one', () => {
		const polish = createTranslator({
			language: 'pl',
			translations: {
				tasks: {
					one: '{count} zadanie',
					few: '{count} zadania',
					many: '{count} zadań',
					other: '{count} zadania'
				}
			}
		});

		expect(polish.t('tasks', { count: 1 })).toBe('1 zadanie');
		expect(polish.t('tasks', { count: 3 })).toBe('3 zadania');
		expect(polish.t('tasks', { count: 5 })).toBe('5 zadań');
	});

	test('falls back to the "other" form when the language has no entry for the category or no count was given', () => {
		const translator = createEnglishTranslator();

		expect(translator.t('onlyOther', { count: 1 })).toBe('always this one');
		expect(translator.t('tasks')).toBe('{count} tasks');
	});

	// A bundle declares itself complete, so a hole in one is only ever a runtime fact: the cast is what stands in for that here
	test('falls back to the fallback bundle for a key the language does not translate yet', () => {
		const incompleteItalian = { plain: 'Testo semplice' } as unknown as typeof TRANSLATIONS;
		const translator = createTranslator({
			language: 'it',
			translations: incompleteItalian,
			fallbackTranslations: TRANSLATIONS
		});

		expect(translator.t('plain')).toBe('Testo semplice');
		expect(translator.t('translatedOnlyHere')).toBe('Only in the fallback');
	});

	test('reports a key no bundle holds and shows the key itself', () => {
		const onMissingTranslation = vi.fn();
		const translator = createTranslator({
			language: 'en',
			translations: TRANSLATIONS,
			onMissingTranslation
		});

		// The key type keeps this from happening by accident, so a bundle that lost a key is what this stands in for
		expect(translator.t('group.missing' as 'plain')).toBe('group.missing');
		expect(onMissingTranslation).toHaveBeenCalledWith('group.missing');
	});

	test('does not mistake a group for a translation', () => {
		const onMissingTranslation = vi.fn();
		const translator = createTranslator({
			language: 'en',
			translations: TRANSLATIONS,
			onMissingTranslation
		});

		expect(translator.t('group' as 'plain')).toBe('group');
		expect(translator.t('plain.deeper' as 'plain')).toBe('plain.deeper');
		expect(onMissingTranslation).toHaveBeenCalledTimes(2);
	});

	test('joins a list the way the locale joins one', () => {
		expect(createEnglishTranslator().formatList([ 'one thing', 'another', 'a third' ])).toBe('one thing, another, a third');
		expect(createEnglishTranslator().formatList([ 'only one' ])).toBe('only one');
	});

	test('formats in the language unless a separate locale is given', () => {
		const translator = createEnglishTranslator();
		const regional = createTranslator({ language: 'en', locale: 'en-GB', translations: TRANSLATIONS });

		expect(translator.locale).toBe('en');
		expect(translator.language).toBe('en');
		expect(regional.locale).toBe('en-GB');
		expect(regional.language).toBe('en');
	});
});
