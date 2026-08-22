import 'src/components/session/UnwrittenChangesPrompt.css';
import type { ReactElement } from 'react';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { getFileName } from 'src/logic/format/FilePathDisplay';

/**
 * What is said when a close found changes the file never took.
 *
 * The write-failure panel is the ordinary way this ends: the session carries on in memory and the way out is to free the disk,
 * reconnect the volume or unlock the file. **But the ways out of the application do not go through that panel** — the File menu
 * and the window's own close button are the platform's, and they reach the session whatever is on screen. A close that went
 * ahead there would take the model down with it, silently, and nothing else has a copy of it.
 *
 * So the departure stops here and the two answers are the only two there are. *Discard and close* gives the changes up and lets
 * the close finish, which is a decision only the user can take. *Stay* keeps the session exactly as it was, with the failure
 * still on screen saying what stopped the write.
 *
 * It belongs to no screen, like the write-failure panel it stands in for, so it sits beside it.
 * @returns The prompt, while a close is waiting on it.
 */
export const UnwrittenChangesPrompt = (): ReactElement | null => {
	const { t } = useTranslator();
	const { unwrittenChangesPrompt, discardUnwrittenChanges, keepUnwrittenChanges } = useLedger();

	if(!unwrittenChangesPrompt) {
		return null;
	}

	return (
		<ConfirmDialog
			danger
			title={t('unwrittenChanges.title')}
			message={
				<>
					<p className='unwritten-changes-message'>
						{t('unwrittenChanges.message', { name: getFileName(unwrittenChangesPrompt.filePath) })}
					</p>
					<p className='unwritten-changes-reason'>{unwrittenChangesPrompt.message}</p>
					<p className='unwritten-changes-message'>{t('unwrittenChanges.consequence')}</p>
				</>
			}
			confirmLabel={t('unwrittenChanges.discard')}
			cancelLabel={t('unwrittenChanges.stay')}
			onConfirm={() => {
				void discardUnwrittenChanges();
			}}
			onCancel={keepUnwrittenChanges}/>
	);
};
