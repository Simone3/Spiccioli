import { resolveLanguage } from 'src/framework/i18n/LanguageResolution';

const AVAILABLE_LANGUAGES = [ 'en', 'it', 'pt-BR' ];

const resolve = (requestedLanguages: readonly string[]): string => {
	return resolveLanguage({
		requestedLanguages,
		availableLanguages: AVAILABLE_LANGUAGES,
		fallbackLanguage: 'en'
	});
};

describe('LanguageResolution', () => {
	test('takes an available language as it is', () => {
		expect(resolve([ 'it' ])).toBe('it');
	});

	test('matches an available language whatever case it is asked for in', () => {
		expect(resolve([ 'PT-br' ])).toBe('pt-BR');
	});

	test('falls back from a regional tag to the base language', () => {
		expect(resolve([ 'it-CH' ])).toBe('it');
	});

	test('matches a base language against the only regional bundle there is', () => {
		expect(resolve([ 'pt' ])).toBe('pt-BR');
	});

	test('takes the first language it can serve rather than the first one asked for', () => {
		expect(resolve([ 'de', 'fr', 'it' ])).toBe('it');
	});

	test('falls back when nothing asked for can be served', () => {
		expect(resolve([ 'de', 'fr' ])).toBe('en');
	});

	test('falls back when nothing is asked for at all', () => {
		expect(resolve([])).toBe('en');
		expect(resolve([ '' ])).toBe('en');
	});
});
