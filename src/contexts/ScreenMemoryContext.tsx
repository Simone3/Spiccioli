import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type ReactElement,
	type ReactNode,
	type SetStateAction
} from 'react';

/**
 * What a screen is found showing when it is come back to, and what starts it over.
 *
 * **While one file stays open, a screen is found as it was left** ([§12.2]): the tab
 * it was on, the filters that were set on it and the row that was selected. **What comes back is what the screen was showing,
 * never what it was doing** — an open form, a confirmation, an unwritten rule draft and a bulk selection are the screen acting,
 * and they are gone the moment it is left — so the fields below are the whole of it, listed screen by screen where a reader can
 * see what is remembered without opening five screens to find out.
 *
 * **A hand-over starts the screen over**, which is why `forget` exists: a screen reached from a report cell, a finished import
 * or a failing check's entry is a fresh arrival, and the filters it was handed are the whole of what is set on it rather than
 * an addition to what was left there. Every hand-over goes through `src/components/shell/ScreenHandoff.ts`, which is the one
 * place that forgets before it navigates.
 *
 * **This lives in memory and nowhere else.** It is not a preference and not a field of the file: it is dropped whole when the
 * open file changes, so nothing survives a `New…`, an `Open…` or a run of the application.
 *
 * It is Spiccioli's rather than the framework's because the screens it is keyed by are Spiccioli's, and a store keyed by nothing
 * would not be the safeguard this one is.
 */

// The six screens with something to remember, and exactly what each of them remembers. Checks and Settings carry nothing the
// user sets, and the bulk-import screen belongs to its paste from beginning to end ([§5.7]), so none of the three is here.
// Two of the fields are not filters: the window Portfolio's line is read over and the one the two salary charts share change
// what is drawn and nothing that is computed ([§3.1], [§8.1]).
export interface RememberedFields {
	accounts: 'tab';
	categories: 'tab' | 'reportFilters';
	investments: 'tab' | 'purchaseFilters' | 'saleFilters' | 'holding' | 'security';
	portfolio: 'chartWindow';
	salaries: 'tab' | 'contract' | 'year' | 'chartWindow';
	transactions: 'filters' | 'page';
}

export type RememberedScreen = keyof RememberedFields;

export interface ScreenMemoryContextValue {

	// What the screen was showing, or undefined where it has been forgotten or was never on screen
	recall: (screen: RememberedScreen, field: string) => unknown;

	remember: (screen: RememberedScreen, field: string, value: unknown) => void;

	// One screen started over, which is what a hand-over does before it navigates
	forget: (screen: RememberedScreen) => void;

	// Every screen started over, which is what a different file does
	forgetEverything: () => void;
}

const ScreenMemoryContext = createContext<ScreenMemoryContextValue | undefined>(undefined);

/**
 * Provides the memory the screens are found by.
 * @param props The provider's props.
 * @param props.children The tree that remembers through it.
 * @returns The provider.
 */
export const ScreenMemoryProvider = ({ children }: { children: ReactNode }): ReactElement => {
	// A ref and not state: nothing on screen reads this except a screen being mounted, and a write of it must never redraw one
	const screensRef = useRef(new Map<RememberedScreen, Map<string, unknown>>());

	const recall = useCallback((screen: RememberedScreen, field: string): unknown => {
		return screensRef.current.get(screen)?.get(field);
	}, []);

	const remember = useCallback((screen: RememberedScreen, field: string, value: unknown): void => {
		const fields = screensRef.current.get(screen) ?? new Map<string, unknown>();

		fields.set(field, value);
		screensRef.current.set(screen, fields);
	}, []);

	const forget = useCallback((screen: RememberedScreen): void => {
		screensRef.current.delete(screen);
	}, []);

	const forgetEverything = useCallback((): void => {
		screensRef.current.clear();
	}, []);

	const value = useMemo((): ScreenMemoryContextValue => {
		return { recall, remember, forget, forgetEverything };
	}, [ forget, forgetEverything, recall, remember ]);

	return (
		<ScreenMemoryContext.Provider value={value}>
			{children}
		</ScreenMemoryContext.Provider>
	);
};

/**
 * Reads the memory itself, which is what a hand-over and the shell reach for to start a screen over.
 * @returns The memory.
 */
export const useScreenMemory = (): ScreenMemoryContextValue => {
	const value = useContext(ScreenMemoryContext);

	if(!value) {
		throw new Error('useScreenMemory was called outside the ScreenMemoryProvider.');
	}

	return value;
};

/**
 * One piece of what a screen is showing, kept for as long as the file is open.
 *
 * It is `useState` with a memory behind it: the screen reads and writes it exactly as it would its own state, and the value it
 * opens with is the one it was left showing where there is one and the default where there is not.
 * **The value's type is written out where the default alone does not say it**, exactly as `useState` needs it written out for a
 * field that starts empty or on one of a closed set — `useRemembered<InvestmentsTab>('investments', 'tab', 'holdings')`.
 * @param screen The screen the field belongs to.
 * @param field Which of that screen's fields this is.
 * @param initial What the screen shows the first time it is opened, and after it has been started over.
 * @returns The value and the way to change it, in the order `useState` returns them.
 */
export const useRemembered = <T, S extends RememberedScreen = RememberedScreen>(
	screen: S,
	field: RememberedFields[S],
	initial: T
): [ T, Dispatch<SetStateAction<T>> ] => {
	const { recall, remember } = useScreenMemory();

	// Read once, on mount: what is in the memory afterwards is what this state put there
	const [ value, setValue ] = useState<T>(() => {
		const remembered = recall(screen, field);

		return remembered === undefined ? initial : remembered as T;
	});

	// Written after the render rather than inside the setter, so a value the screen never showed is never remembered
	useEffect(() => {
		remember(screen, field, value);
	}, [ field, remember, screen, value ]);

	return [ value, setValue ];
};
