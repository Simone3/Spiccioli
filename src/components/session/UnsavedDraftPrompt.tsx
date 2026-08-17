import type { ReactElement } from 'react';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useUnsavedDraftGuard } from 'src/contexts/UnsavedDraftContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * What is said when something on screen has not been written and the user is leaving anyway.
 *
 * **Two ways out and no third.** *Discard changes* throws the draft away and lets the departure through; *Stay* cancels the
 * departure and leaves the draft on screen untouched. **There is no *apply* here**: applying is a decision taken against the
 * consequence summary of [§6.2], which states how many transactions change, lose a category or gain one before anything is
 * written, and a dialog raised by walking away would let a rule change be committed by someone whose actual intention was to
 * leave.
 *
 * It belongs to no screen — the departures it guards are leaving one, closing the file and quitting — so it sits beside the
 * write-failure panel rather than inside the screen that raised it.
 * @returns The prompt, while a departure is waiting on it.
 */
export const UnsavedDraftPrompt = (): ReactElement | null => {
	const { t } = useTranslator();
	const { pendingDeparture, discardAndProceed, stay } = useUnsavedDraftGuard();

	if(!pendingDeparture) {
		return null;
	}

	return (
		<ConfirmDialog
			danger
			title={t('unsavedDraft.title')}
			message={t('unsavedDraft.message')}
			confirmLabel={t('unsavedDraft.discard')}
			cancelLabel={t('unsavedDraft.stay')}
			onConfirm={discardAndProceed}
			onCancel={stay}/>
	);
};
