import 'src/components/shell/Sidebar.css';
import { NavLink, useNavigate } from 'react-router';
import type { ReactElement } from 'react';
import { APP_ROUTES, SIDEBAR_ENTRIES } from 'src/components/shell/AppRoutes';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useUnsavedDraftGuard } from 'src/contexts/UnsavedDraftContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The sidebar: the eight screens, the failing-check badge and the save state.
 *
 * **It does not carry the file's name** — the window title is where the current file is named, and its full path is on Settings.
 *
 * The save state says *Saved 14:32* in the ordinary case, and **the only other things it ever says are that a write is being
 * retried and that one has failed**. There is no third state and no spinner for the ordinary debounced write, so before anything
 * has been written there is nothing here to read.
 *
 * **A screen holding an unwritten draft is left through the guard**, so the link asks before it navigates rather than after: the
 * router is declarative here and has no blocker of its own, and the sidebar is the only way off a screen.
 */

export interface SidebarProps {

	// How many of the fourteen checks are failing, never how many records they name between them. Nothing at all is shown when
	// every check passes.
	failingCheckCount: number;
}

/**
 * The sidebar.
 * @param props The sidebar's props.
 * @param props.failingCheckCount How many checks are failing.
 * @returns The sidebar.
 */
export const Sidebar = ({ failingCheckCount }: SidebarProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const { saveState } = useLedger();
	const { requestDeparture } = useUnsavedDraftGuard();
	const navigate = useNavigate();

	const describeSaveState = (): ReactElement | undefined => {
		switch(saveState.state) {
			case 'saved':
				return <p className='sidebar-save-state'>{t('session.saved', { time: formatter.timeOfDay(new Date(saveState.savedAt)) })}</p>;
			case 'retrying':
				return (
					<p className='sidebar-save-state sidebar-save-state-warning' role='status'>
						{t('session.retrying', { attempt: saveState.attempt, attempts: saveState.maximumAttempts })}
					</p>
				);
			case 'failed':
				return <p className='sidebar-save-state sidebar-save-state-failed' role='status'>{t('session.saveFailed')}</p>;
			case 'idle':
			default:
				return undefined;
		}
	};

	return (
		<nav className='sidebar' aria-label={t('screens.navigation')}>
			<p className='sidebar-brand'>
				<span className='sidebar-brand-initial'>{t('app.name').charAt(0)}</span>
				{t('app.name').slice(1)}
			</p>

			<div className='sidebar-nav'>
				{SIDEBAR_ENTRIES.map((entry) => {
					return (
						<NavLink
							key={entry.route}
							to={entry.route}
							end={entry.isRoot}
							className={({ isActive }) => {
								return isActive ? 'sidebar-link sidebar-link-current' : 'sidebar-link';
							}}
							onClick={(event) => {
								event.preventDefault();
								requestDeparture(() => {
									void navigate(entry.route);
								});
							}}>
							<span>{t(entry.labelKey)}</span>
							{entry.route === APP_ROUTES.checks && failingCheckCount > 0 && (
								<span className='sidebar-badge'>{formatter.integer(failingCheckCount)}</span>
							)}
						</NavLink>
					);
				})}
			</div>

			{describeSaveState()}
		</nav>
	);
};
