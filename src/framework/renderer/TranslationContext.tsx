import { createContext, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import type { TranslationTree, Translator } from 'src/framework/types/TranslationTypes';

export interface TranslationContextValue<TTranslations> {
	translator: Translator<TTranslations>;
	language: string;

	// Changing the language re-renders everything below the provider, which is what makes the whole UI switch at once
	setLanguage: (language: string) => void;
}

export interface CreateTranslationContextOptions<TTranslations extends TranslationTree> {

	// The application owns which bundle belongs to a language, so the context only ever asks it for a translator
	createTranslator: (language: string) => Translator<TTranslations>;
	initialLanguage: string;
}

export interface TranslationContextBinding<TTranslations> {
	TranslationProvider: (props: { children: ReactNode }) => ReactElement;

	// The translator alone, which is what almost every component needs
	useTranslator: () => Translator<TTranslations>;

	// The current language and the way to change it, which only a language picker needs
	useLanguage: () => Pick<TranslationContextValue<TTranslations>, 'language' | 'setLanguage'>;
}

// Creates the React binding for one translation bundle. It is a factory rather than a ready-made context because the bundle type
// belongs to the application, and because the framework holds no module-level state of its own.
export const createTranslationContext = <TTranslations extends TranslationTree>({
	createTranslator,
	initialLanguage
}: CreateTranslationContextOptions<TTranslations>): TranslationContextBinding<TTranslations> => {
	const TranslationContext = createContext<TranslationContextValue<TTranslations> | undefined>(undefined);

	const TranslationProvider = ({ children }: { children: ReactNode }): ReactElement => {
		const [ language, setLanguage ] = useState(initialLanguage);

		// The translator is rebuilt only when the language changes, so every render below the provider reads the same one
		const contextValue = useMemo((): TranslationContextValue<TTranslations> => {
			return {
				translator: createTranslator(language),
				language,
				setLanguage
			};
		}, [ language ]);

		return (
			<TranslationContext.Provider value={contextValue}>
				{children}
			</TranslationContext.Provider>
		);
	};

	const useTranslationContext = (): TranslationContextValue<TTranslations> => {
		const contextValue = useContext(TranslationContext);

		if(!contextValue) {
			throw new Error('No translation provider is mounted above this component.');
		}

		return contextValue;
	};

	const useTranslator = (): Translator<TTranslations> => {
		return useTranslationContext().translator;
	};

	const useLanguage = (): Pick<TranslationContextValue<TTranslations>, 'language' | 'setLanguage'> => {
		const { language, setLanguage } = useTranslationContext();

		return { language, setLanguage };
	};

	return {
		TranslationProvider,
		useTranslator,
		useLanguage
	};
};
