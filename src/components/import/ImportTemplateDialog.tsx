import { useState, type ReactElement } from 'react';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { useTranslator } from 'src/i18n/TranslationContext';
import { IMPORT_TEMPLATES } from 'src/logic/import/ImportTemplates';
import type { ImportTemplate } from 'src/logic/import/ImportTemplate';

/**
 * Which export is about to be read, asked before the file chooser opens.
 *
 * **The template is chosen first and the file second**, because the template is what says how to read the file: a workbook
 * handed over with nothing said about it is a workbook nothing can do anything with. It opens unchosen every time, like every
 * other picker in the application.
 *
 * **What the panel says about the template it is on is the shape it expects** — the sheet, the headings, the way that export
 * writes a date — so that a file refused afterwards is refused against something the user has already read.
 */

// The entry the picker opens on, until a template is chosen. It is never one that is acted on.
const NOTHING_CHOSEN = '';

export interface ImportTemplateDialogProps {

	// Called with the template chosen, which is what opens the file chooser
	onChoose: (template: ImportTemplate) => void;

	onCancel: () => void;
}

/**
 * The template picker.
 * @param props The dialog's props.
 * @param props.onChoose What to do with the template chosen.
 * @param props.onCancel What cancelling does.
 * @returns The dialog.
 */
export const ImportTemplateDialog = ({ onChoose, onCancel }: ImportTemplateDialogProps): ReactElement => {
	const { t } = useTranslator();
	const [ chosenId, setChosenId ] = useState<string>(NOTHING_CHOSEN);

	const chosen = IMPORT_TEMPLATES.find((template) => {
		return template.id === chosenId;
	});

	const options: readonly SelectOption<string>[] = [
		{ value: NOTHING_CHOSEN, label: t('import.templateChoose') },
		...IMPORT_TEMPLATES.map((template) => {
			return { value: template.id, label: t(`import.templates.${template.id}.name`) };
		})
	];

	return (
		<FormDialog
			title={t('import.uploadTitle')}
			subtitle={t('import.uploadSubtitle')}
			canSave={chosen !== undefined}
			saveLabel={t('import.uploadChooseFile')}
			onSave={() => {
				if(chosen) {
					onChoose(chosen);
				}
			}}
			onCancel={onCancel}>
			<FormField
				label={t('import.template')}
				hint={chosen ? t(`import.templates.${chosen.id}.shape`) : t('import.templateNote')}>
				<SelectField
					value={chosenId}
					options={options}
					label={t('import.template')}
					onChange={setChosenId}/>
			</FormField>
		</FormDialog>
	);
};
