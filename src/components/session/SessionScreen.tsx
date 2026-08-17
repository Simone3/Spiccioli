import 'src/components/session/SessionScreen.css';
import { type ReactElement } from 'react';
import { useLedger } from 'src/contexts/LedgerContext';
import { usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatTimeOfDay } from 'src/logic/format/DateFormat';
import { getFileNameWithoutExtension } from 'src/logic/format/FilePathDisplay';
import { LEDGER_ENTITY_NAME_KEYS } from 'src/logic/ledger/LedgerRefusalMessage';
import { LEDGER_ENTITY_KEYS } from 'src/types/LedgerTypes';

/**
 * What an open file looks like until the shell is built.
 *
 * The eight screens, the sidebar and the router are the next phase's; what has to exist now is a place for the three things the
 * storage specification puts on screen while a file is open — the save state, the line that appears while a failed write is
 * being retried, and the line that says something else changed the file. This screen is where they live until the sidebar takes
 * the save state and every screen inherits the lines.
 * @returns The screen.
 */
export const SessionScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { preferences } = usePreferences();
	const {
		document,
		filePath,
		saveState,
		externalModification,
		dismissExternalModification,
		closingBackupFailureMessage,
		dismissClosingBackupFailure
	} = useLedger();

	if(!document || !filePath) {
		return <></>;
	}

	const describeSaveState = (): string => {
		switch(saveState.state) {
			case 'saved':
				return t('session.saved', { time: formatTimeOfDay(new Date(saveState.savedAt)) });
			case 'retrying':
				return t('session.retrying', { attempt: saveState.attempt, attempts: saveState.maximumAttempts });
			case 'failed':
				return t('session.saveFailed');
			case 'idle':
			default:
				return t('session.noChangesYet');
		}
	};

	return (
		<div className='session-screen'>
			<header className='session-screen-header'>
				<h1 className='session-screen-title'>{getFileNameWithoutExtension(filePath)}</h1>
				<p className='session-screen-state'>{describeSaveState()}</p>
			</header>

			{saveState.state === 'retrying' && (
				<div className='session-screen-notice session-screen-notice-warning' role='status'>
					<p>{t('session.retryingExplanation')}</p>
				</div>
			)}

			{externalModification && (
				<div className='session-screen-notice' role='status'>
					<p>
						{externalModification.backup.written ?
							t('session.externalModification', {
								name: externalModification.backup.backupFileName ?? '',

								// The count in that sentence is the preference as it currently stands, not how many copies the folder happens to hold
								count: preferences.backupCount
							}) :
							t('session.externalModificationNotCopied', { message: externalModification.backup.message ?? '' })}
					</p>
					<button type='button' className='session-screen-link' onClick={dismissExternalModification}>
						{t('session.dismiss')}
					</button>
				</div>
			)}

			{closingBackupFailureMessage && (
				<div className='session-screen-notice session-screen-notice-warning' role='alert'>
					<p>{t('session.closingBackupFailed', { message: closingBackupFailureMessage })}</p>
					<button type='button' className='session-screen-link' onClick={dismissClosingBackupFailure}>
						{t('session.dismiss')}
					</button>
				</div>
			)}

			<p className='session-screen-hint'>{t('session.placeholder')}</p>

			<table className='session-screen-counts'>
				<tbody>
					{LEDGER_ENTITY_KEYS.map((entity) => {
						return (
							<tr key={entity}>
								<th scope='row'>{t(LEDGER_ENTITY_NAME_KEYS[entity])}</th>
								<td>{document[entity].length}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};
