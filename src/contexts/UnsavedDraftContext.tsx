import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';

/**
 * The one thing on screen that is not in the file, and what has to happen before it can be walked away from.
 *
 * **Almost nothing in Spiccioli is unsaved**: every screen writes as it is used and the file follows two seconds later. The
 * rule list of [§6.2] is the exception and is specified as one — it is edited as a draft that writes nothing until *Apply
 * changes* — so leaving the screen, closing the file or quitting with one pending has to say so first.
 *
 * **The prompt offers exactly two ways out, and applying is not one of them.** *Discard* throws the draft away and lets the
 * departure through; *stay* cancels the departure and leaves the draft exactly as it was. Applying is a decision taken against
 * the consequence summary, which says how many transactions change before anything is written, and a dialog raised by walking
 * away is the wrong place to take it.
 *
 * This sits **above the ledger**, because closing the file and quitting are two of the three departures it guards.
 */

// What a screen holding an unwritten draft registers: the one thing that has to happen before the departure it was raised by
export interface UnsavedDraft {
	discard: () => void;
}

// A departure waiting on the prompt: what to do once the draft is thrown away, and what to do when it is not
interface PendingDeparture {
	proceed: () => void;

	// Called when the user stays, for a departure that has to be called off elsewhere as well — a quit the main process started
	onStay?: () => void;
}

export interface UnsavedDraftContextValue {

	// Whether anything on screen is holding a draft that nothing has been written from
	isPending: boolean;

	// Called by the screen that holds one, with undefined once it holds none
	registerUnsavedDraft: (draft: UnsavedDraft | undefined) => void;

	/**
	 * The one way anything leaves: it runs straight away where nothing is pending, and raises the prompt where something is.
	 * @returns Whether the departure went through. False means the prompt is up and a person is being waited on, which a caller
	 * whose departure is being timed elsewhere — a quit the main process is counting — has to know about.
	 */
	requestDeparture: (proceed: () => void, onStay?: () => void) => boolean;

	// The departure the prompt is up for, and the two ways out of it
	pendingDeparture: boolean;
	discardAndProceed: () => void;
	stay: () => void;
}

const UnsavedDraftContext = createContext<UnsavedDraftContextValue | undefined>(undefined);

/**
 * Provides the guard every departure goes through.
 * @param props The provider's props.
 * @param props.children The tree that leaves through it.
 * @returns The provider.
 */
export const UnsavedDraftProvider = ({ children }: { children: ReactNode }): ReactElement => {
	// The draft as the departure sees it, which has to be whatever is registered now rather than what a render closed over
	const draftRef = useRef<UnsavedDraft | undefined>(undefined);
	const [ isPending, setIsPending ] = useState(false);
	const [ departure, setDeparture ] = useState<PendingDeparture | undefined>(undefined);

	const registerUnsavedDraft = useCallback((draft: UnsavedDraft | undefined): void => {
		draftRef.current = draft;
		setIsPending(draft !== undefined);
	}, []);

	const requestDeparture = useCallback((proceed: () => void, onStay?: () => void): boolean => {
		if(!draftRef.current) {
			proceed();

			return true;
		}

		setDeparture({ proceed, onStay });

		return false;
	}, []);

	const discardAndProceed = useCallback((): void => {
		if(!departure) {
			return;
		}

		draftRef.current?.discard();
		setDeparture(undefined);
		departure.proceed();
	}, [ departure ]);

	const stay = useCallback((): void => {
		if(!departure) {
			return;
		}

		setDeparture(undefined);
		departure.onStay?.();
	}, [ departure ]);

	const value = useMemo((): UnsavedDraftContextValue => {
		return {
			isPending,
			registerUnsavedDraft,
			requestDeparture,
			pendingDeparture: departure !== undefined,
			discardAndProceed,
			stay
		};
	}, [ departure, discardAndProceed, isPending, registerUnsavedDraft, requestDeparture, stay ]);

	return (
		<UnsavedDraftContext.Provider value={value}>
			{children}
		</UnsavedDraftContext.Provider>
	);
};

/**
 * Reads the guard, which is how the sidebar, the file and the quit ask to leave.
 * @returns The guard.
 */
export const useUnsavedDraftGuard = (): UnsavedDraftContextValue => {
	const value = useContext(UnsavedDraftContext);

	if(!value) {
		throw new Error('useUnsavedDraftGuard was called outside the UnsavedDraftProvider.');
	}

	return value;
};

/**
 * Registers the draft a screen is holding, and takes it back when the screen no longer holds one or is no longer on screen.
 * @param isPending Whether the screen is holding a draft nothing has been written from.
 * @param discard What throwing that draft away does.
 */
export const useUnsavedDraft = (isPending: boolean, discard: () => void): void => {
	const { registerUnsavedDraft } = useUnsavedDraftGuard();

	// The screen hands a new function on every render, and the registration must not be redone for that
	const discardRef = useRef(discard);

	useEffect(() => {
		discardRef.current = discard;
	}, [ discard ]);

	useEffect(() => {
		registerUnsavedDraft(isPending ?
			{
				discard: () => {
					discardRef.current();
				}
			} :
			undefined);

		return () => {
			registerUnsavedDraft(undefined);
		};
	}, [ isPending, registerUnsavedDraft ]);
};
