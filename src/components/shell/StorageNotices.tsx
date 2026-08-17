import 'src/components/shell/StorageNotices.css';
import type { ReactElement } from 'react';
import { useLedger } from 'src/contexts/LedgerContext';
import { usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The three things the file has to be able to say, on whichever screen the user is on.
 *
 * They belong to no screen, which is why they are drawn here above every one of them: a write that is being retried, a version
 * of the file that something else displaced, and a closing copy that could not be written. **None of them blocks and none of
 * them is a modal** — the blocking message after the fifth failed attempt is the write-failure panel, and it sits outside the
 * shell because it is not part of any screen either.
 */

/**
 * The storage lines.
 * @returns Whatever the file currently has to say, or nothing.
 */
export const StorageNotices = (): ReactElement => {
	const { t } = useTranslator();
	const { preferences } = usePreferences();
	const {
		saveState,
		externalModification,
		dismissExternalModification,
		closingBackupFailureMessage,
		dismissClosingBackupFailure
	} = useLedger();

	return (
		<div className='storage-notices'>
			{saveState.state === 'retrying' && (
				<div className='storage-notice storage-notice-warning' role='status'>
					<p>{t('session.retryingExplanation')}</p>
				</div>
			)}

			{externalModification && (
				<div className='storage-notice' role='status'>
					<p>
						{externalModification.backup.written ?
							t('session.externalModification', {
								name: externalModification.backup.backupFileName ?? '',

								// The count in that sentence is the preference as it currently stands, not how many copies the folder happens to hold
								count: preferences.backupCount
							}) :
							t('session.externalModificationNotCopied', { message: externalModification.backup.message ?? '' })}
					</p>
					<button type='button' className='storage-notice-dismiss' onClick={dismissExternalModification}>
						{t('session.dismiss')}
					</button>
				</div>
			)}

			{closingBackupFailureMessage && (
				<div className='storage-notice storage-notice-warning' role='alert'>
					<p>{t('session.closingBackupFailed', { message: closingBackupFailureMessage })}</p>
					<button type='button' className='storage-notice-dismiss' onClick={dismissClosingBackupFailure}>
						{t('session.dismiss')}
					</button>
				</div>
			)}
		</div>
	);
};
