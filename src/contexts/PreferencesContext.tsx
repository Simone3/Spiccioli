import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { createFormatter, type Formatter } from 'src/logic/format/Formatter';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { Preferences } from 'src/types/PreferencesTypes';

/**
 * The preferences, read once at startup and written the moment one changes.
 *
 * They are not in the ledger and they never mark it as modified: they belong to the installation and live in the platform's own
 * application-data location. Changing one applies immediately — there is no save button — which is why the value in this context
 * is updated before the write rather than after it.
 *
 * The formatter is a reading of the preferences and lives here for that reason: a screen that prints a figure takes it from
 * here, so a preference that changes produces a new formatter and re-renders every figure on screen in the same pass.
 */

export interface PreferencesContextValue {
	preferences: Preferences;
	setPreferences: (preferences: Preferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

/**
 * Provides the preferences to every screen that formats something.
 * @param props The provider's props.
 * @param props.children The tree that reads them.
 * @returns The provider.
 */
export const PreferencesProvider = ({ children }: { children: ReactNode }): ReactElement => {
	// The defaults are in force until the answer arrives, which is one frame and never a loading state
	const [ preferences, setLocalPreferences ] = useState<Preferences>(DEFAULT_PREFERENCES);

	useEffect(() => {
		let isMounted = true;

		void Promise.resolve().then(() => {
			return window.spiccioliLedger.getPreferences();
		}).then((stored) => {
			if(isMounted) {
				setLocalPreferences(stored);
			}
		}).catch(() => {
			// A preference that cannot be read is a preference at its default, which is already what is in force here
		});

		return () => {
			isMounted = false;
		};
	}, []);

	const setPreferences = useCallback((next: Preferences): void => {
		setLocalPreferences(next);
		void window.spiccioliLedger.setPreferences(next);
	}, []);

	const value = useMemo((): PreferencesContextValue => {
		return { preferences, setPreferences };
	}, [ preferences, setPreferences ]);

	return (
		<PreferencesContext.Provider value={value}>
			{children}
		</PreferencesContext.Provider>
	);
};

/**
 * Reads the preferences.
 * @returns The preferences and the way to change one.
 */
export const usePreferences = (): PreferencesContextValue => {
	const value = useContext(PreferencesContext);

	if(!value) {
		throw new Error('usePreferences was called outside the PreferencesProvider.');
	}

	return value;
};

/**
 * Reads the formatter the preferences in force define.
 * @returns Every way a figure or a day reaches the screen.
 */
export const useFormatter = (): Formatter => {
	const { preferences } = usePreferences();

	return useMemo(() => {
		return createFormatter(preferences);
	}, [ preferences ]);
};
