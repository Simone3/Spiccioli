import 'src/components/common/InlineEditCell.css';
import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * A cell that turns into its own editor, and the rule that a refused value never leaves the row half-changed.
 *
 * **A refused value keeps the cell open and the previous value in force**, with the reason stated where the offending value is
 * and never as a modal. Escape abandons the edit and puts back what was there; the row is only ever written when the value was
 * taken.
 */

export interface InlineEditCellControls {

	// Takes the value if it can be taken, and leaves the cell open with the reason if it cannot
	commit: () => void;

	// Puts back what was there
	cancel: () => void;
}

export interface InlineEditCellProps {

	// What the cell reads when it is not being edited
	children: ReactNode;

	// What the control that opens the editor is called
	label: string;

	// The editor, which is handed the two things it can do
	renderEditor: (controls: InlineEditCellControls) => ReactNode;

	// Called when the edit is committed. Returns nothing when the value was taken, or the reason it was refused.
	onCommit: () => string | undefined;

	// Called when the edit is abandoned, so the caller can put back the value it had
	onCancel?: () => void;

	disabled?: boolean;
}

/**
 * The one inline editor.
 * @param props The cell's props.
 * @param props.children What the cell reads when it is closed.
 * @param props.label What the control that opens it is called.
 * @param props.renderEditor The editor.
 * @param props.onCommit What taking the value does, and what says it could not be taken.
 * @param props.onCancel What abandoning the edit does.
 * @param props.disabled Whether the cell can be edited at all.
 * @returns The cell.
 */
export const InlineEditCell = ({ children, label, renderEditor, onCommit, onCancel, disabled = false }: InlineEditCellProps): ReactElement => {
	const { t } = useTranslator();
	const refusalId = useId();
	const [ isEditing, setIsEditing ] = useState(false);
	const [ refusal, setRefusal ] = useState<string | undefined>(undefined);

	const cancel = (): void => {
		setIsEditing(false);
		setRefusal(undefined);
		onCancel?.();
	};

	const commit = (): void => {
		const reason = onCommit();

		// Refused: the cell stays open, the reason is stated here, and the row is exactly as it was
		if(reason) {
			setRefusal(reason);

			return;
		}

		setIsEditing(false);
		setRefusal(undefined);
	};

	if(!isEditing) {
		return (
			<button
				type='button'
				className='inline-edit-cell-value'
				disabled={disabled}
				aria-label={label}
				onClick={() => {
					setIsEditing(true);
				}}>
				{children}
			</button>
		);
	}

	return (
		<div
			className='inline-edit-cell'
			aria-describedby={refusal ? refusalId : undefined}
			onKeyDown={(event) => {
				if(event.key === 'Escape') {
					cancel();
				}
				else if(event.key === 'Enter') {
					commit();
				}
			}}>
			<div className='inline-edit-cell-editor'>
				{renderEditor({ commit, cancel })}
				<AppButton variant='primary' onClick={commit}>{t('inlineEdit.save')}</AppButton>
				<AppButton variant='ghost' onClick={cancel}>{t('inlineEdit.cancel')}</AppButton>
			</div>
			{refusal && <p className='inline-edit-cell-refusal' id={refusalId} role='alert'>{refusal}</p>}
		</div>
	);
};
