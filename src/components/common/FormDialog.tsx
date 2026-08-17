import 'src/components/common/FormDialog.css';
import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * The panel a record is created and corrected in, and the row a field sits on inside it.
 *
 * **A refused value is stated beside the field that holds it** and never here: what this panel does about a form it cannot
 * save is disable the saving button, which is what the validation specification asks of every form. The keyboard opens on the
 * first field, Escape cancels, and nothing outside the panel is reachable while it is up.
 *
 * It and the confirmation are the only modals the application has. **An error is never one.**
 */

export interface FormDialogProps {
	title: string;

	// Where the form was opened from, where saying so helps: "from the Institutions tab"
	subtitle?: string;

	// The fields, as "FormField" rows
	children: ReactNode;

	// Whether the form holds a record that can be written. A form that cannot be saved states why beside the offending field.
	canSave: boolean;

	onSave: () => void;
	onCancel: () => void;
}

export interface FormFieldProps {
	label: string;

	// The control, which states a refusal of its own value itself
	children: ReactNode;

	// What the field means, where the screen's specification says something about it that the label cannot carry
	hint?: string;

	// Why this field cannot be saved, where what is wrong is its value against another field's rather than its own
	refusal?: string;
}

/**
 * One field on a form: what it is called, the control, and whatever the specification says about it.
 * @param props The field's props.
 * @param props.label What the field is called.
 * @param props.children The control.
 * @param props.hint What the field means, where it needs saying.
 * @param props.refusal Why the form will not take this field, where the control cannot say so itself.
 * @returns The field.
 */
export const FormField = ({ label, children, hint, refusal }: FormFieldProps): ReactElement => {
	return (
		<>
			<span className='form-dialog-field-label'>{label}</span>
			<div className='form-dialog-field-control'>
				{children}
				{refusal && <p className='form-dialog-field-refusal'>{refusal}</p>}
				{hint && <p className='form-dialog-field-hint'>{hint}</p>}
			</div>
		</>
	);
};

/**
 * The form panel.
 * @param props The dialog's props.
 * @param props.title What is being created or corrected.
 * @param props.subtitle Where the form was opened from, where it needs saying.
 * @param props.children The fields.
 * @param props.canSave Whether what the form holds can be written.
 * @param props.onSave What saving does.
 * @param props.onCancel What cancelling does, which is also what Escape does.
 * @returns The dialog.
 */
export const FormDialog = ({ title, subtitle, children, canSave, onSave, onCancel }: FormDialogProps): ReactElement => {
	const { t } = useTranslator();
	const titleId = useId();
	const fieldsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fieldsRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
	}, []);

	return (
		<div
			className='form-dialog-overlay'
			role='presentation'
			onKeyDown={(event) => {
				if(event.key === 'Escape') {
					onCancel();
				}
			}}>
			<div className='form-dialog' role='dialog' aria-modal='true' aria-labelledby={titleId}>
				<div className='form-dialog-heading'>
					<h2 className='form-dialog-title' id={titleId}>{title}</h2>
					{subtitle && <span className='form-dialog-subtitle'>{subtitle}</span>}
				</div>
				<div className='form-dialog-fields' ref={fieldsRef}>{children}</div>
				<div className='form-dialog-actions'>
					<AppButton variant='ghost' onClick={onCancel}>{t('dialog.cancel')}</AppButton>
					<AppButton variant='primary' disabled={!canSave} onClick={onSave}>{t('form.save')}</AppButton>
				</div>
			</div>
		</div>
	);
};
