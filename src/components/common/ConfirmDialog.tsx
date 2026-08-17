import 'src/components/common/ConfirmDialog.css';
import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The confirmation every delete asks for.
 *
 * There is no undo in the application, which is the whole reason this exists: a record that goes is gone, so the gesture that
 * removes it says what it is about to remove. **It is the only kind of modal the application has** — an error is never one, and
 * is shown where the thing failed.
 *
 * The keyboard opens on the cancelling button, Escape cancels, and nothing outside the dialog is reachable while it is up.
 */

export interface ConfirmDialogProps {
	title: string;

	// What is about to happen, in the words of the screen that is asking
	message: ReactNode;

	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;

	// A delete, which is what most of these are
	danger?: boolean;
}

/**
 * The confirmation.
 * @param props The dialog's props.
 * @param props.title What it is about.
 * @param props.message What is about to happen.
 * @param props.confirmLabel What the confirming button says.
 * @param props.onConfirm What confirming does.
 * @param props.onCancel What cancelling does, which is also what Escape does.
 * @param props.danger Whether what is about to happen is a delete.
 * @returns The dialog.
 */
export const ConfirmDialog = ({ title, message, confirmLabel, onConfirm, onCancel, danger = false }: ConfirmDialogProps): ReactElement => {
	const { t } = useTranslator();
	const titleId = useId();
	const cancelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		cancelRef.current?.querySelector('button')?.focus();
	}, []);

	return (
		<div
			className='confirm-dialog-overlay'
			role='presentation'
			onKeyDown={(event) => {
				if(event.key === 'Escape') {
					onCancel();
				}
			}}>
			<div className='confirm-dialog' role='dialog' aria-modal='true' aria-labelledby={titleId}>
				<h2 className='confirm-dialog-title' id={titleId}>{title}</h2>
				<div className='confirm-dialog-message'>{message}</div>
				<div className='confirm-dialog-actions'>
					<div ref={cancelRef}>
						<AppButton onClick={onCancel}>{t('dialog.cancel')}</AppButton>
					</div>
					<AppButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</AppButton>
				</div>
			</div>
		</div>
	);
};
