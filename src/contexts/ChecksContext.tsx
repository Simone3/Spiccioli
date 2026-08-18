import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { CHECKS_CONFIG } from 'src/config/AppConfig';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { countFailingChecks, runChecks, type CheckResult } from 'src/logic/checks/Checks';
import { deriveMatching, type DerivedMatching } from 'src/logic/checks/Matching';

/**
 * The one place the fourteen checks are run, and the one place the five pairings are derived.
 *
 * **They run at startup and after every change, debounced**: a change schedules a run rather than performing one, and a run
 * already scheduled is superseded by the next. Typing in a cell produces one run when the typing stops, not one per keystroke.
 * **There is no manual re-run**, and nothing on any screen asks for one.
 *
 * **The first run of a file is not debounced.** A file that has just been opened has no previous results to show while it waits,
 * and the badge and the screen would both be reporting a state nobody has computed yet; every run after it is.
 *
 * **The matching is derived here rather than on the screens that show it**, because it is one computation with two readers: the
 * checks report what it left over, and the *Matched* columns of Transactions, Purchases and Sales name what it paired. A cell
 * therefore names its counterpart on the same run that reports it, and never a run apart from it.
 */

export interface ChecksContextValue {

	// The fourteen, always all of them and always in the order of the specification's table. Undefined before the first run.
	results: readonly CheckResult[] | undefined;

	// A count of failing checks, never of the records they name between them. Zero until the first run has landed.
	failingCount: number;

	// The five pairings, which the three *Matched* columns read. Undefined before the first run and while no file is open.
	matching: DerivedMatching | undefined;
}

const ChecksContext = createContext<ChecksContextValue | undefined>(undefined);

/**
 * Runs the checks over whatever file is open, and hands the results to the sidebar, the Checks screen and the three *Matched*
 * columns.
 * @param props The provider's props.
 * @param props.children The tree that reads the checks.
 * @returns The provider.
 */
export const ChecksProvider = ({ children }: { children: ReactNode }): ReactElement => {
	const translator = useTranslator();
	const formatter = useFormatter();
	const { preferences } = usePreferences();
	const { document, filePath } = useLedger();
	const [ run, setRun ] = useState<{ results: readonly CheckResult[]; matching: DerivedMatching } | undefined>(undefined);

	// Which file the results on screen belong to. A file that has just been opened is what the first, undebounced run is for.
	const runFilePathRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		if(!document || !filePath) {
			runFilePathRef.current = undefined;
			setRun(undefined);

			return undefined;
		}

		const perform = (): void => {
			runFilePathRef.current = filePath;

			const matching = deriveMatching({ document, preferences });

			setRun({
				matching,
				results: runChecks({
					document,
					preferences,
					matching,
					translator,
					formatter,

					// The computer's own clock, read as the run starts and never cached
					today: DateUtils.toStandardYearMonthDay(DateUtils.startOfToday())
				})
			});
		};

		if(runFilePathRef.current !== filePath) {
			perform();

			return undefined;
		}

		const scheduled = setTimeout(perform, CHECKS_CONFIG.debounceMs);

		// The run this change scheduled is dropped the moment the next change schedules its own
		return () => {
			clearTimeout(scheduled);
		};
	}, [ document, filePath, preferences, translator, formatter ]);

	const value = useMemo((): ChecksContextValue => {
		return {
			results: run?.results,
			failingCount: run ? countFailingChecks(run.results) : 0,
			matching: run?.matching
		};
	}, [ run ]);

	return <ChecksContext.Provider value={value}>{children}</ChecksContext.Provider>;
};

/**
 * Reads the checks.
 * @returns The fourteen results, how many are failing, and the pairings they were computed from.
 */
export const useChecks = (): ChecksContextValue => {
	const value = useContext(ChecksContext);

	if(!value) {
		throw Error('useChecks must be used inside a ChecksProvider');
	}

	return value;
};
