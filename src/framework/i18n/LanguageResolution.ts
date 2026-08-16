export interface ResolveLanguageOptions {

	// What the runtime reports, best match first. The Electron main process and the renderer read this from different places,
	// so it is passed in rather than looked up here.
	requestedLanguages: readonly string[];

	// The languages the application actually ships a bundle for
	availableLanguages: readonly string[];
	fallbackLanguage: string;
}

const getPrimarySubtag = (language: string): string => {
	return language.toLowerCase().split('-')[0];
};

// Picks the language the application will run in, out of the ones it ships. A regional tag falls back to its base language, so a
// reader on "it-CH" still gets the Italian bundle instead of the fallback, and the fallback is only reached when nothing matches.
export const resolveLanguage = ({ requestedLanguages, availableLanguages, fallbackLanguage }: ResolveLanguageOptions): string => {
	const availableByPrimarySubtag = new Map(availableLanguages.map((availableLanguage) => {
		return [ getPrimarySubtag(availableLanguage), availableLanguage ];
	}));

	for(const requestedLanguage of requestedLanguages) {
		if(!requestedLanguage) {
			continue;
		}

		const exactMatch = availableLanguages.find((availableLanguage) => {
			return availableLanguage.toLowerCase() === requestedLanguage.toLowerCase();
		});

		if(exactMatch) {
			return exactMatch;
		}

		const primarySubtagMatch = availableByPrimarySubtag.get(getPrimarySubtag(requestedLanguage));

		if(primarySubtagMatch) {
			return primarySubtagMatch;
		}
	}

	return fallbackLanguage;
};
