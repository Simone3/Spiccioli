import 'src/components/import/ImportTemplateDialog.css';
import { useMemo, useState, type ReactElement } from 'react';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { TextField } from 'src/components/common/TextField';
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
 * **The templates are a list narrowed by typing rather than a picker.** One bank may have several, and a picker of a few dozen
 * is a picker nobody reads to the end of — where typing a bank's name leaves the two or three entries that could be meant.
 * **Typing narrows and never chooses**: a template is chosen by pressing it, so a search that happens to leave one entry still
 * takes the press that says it was the one meant.
 */

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
	const [ search, setSearch ] = useState('');
	const [ chosenId, setChosenId ] = useState<string | undefined>(undefined);

	const named = useMemo(() => {
		return IMPORT_TEMPLATES.map((template) => {
			return { template, name: t(`import.templates.${template.id}.name`) };
		});
	}, [ t ]);

	const matching = useMemo(() => {
		const wanted = search.trim().toLowerCase();

		return wanted === '' ?
			named :
			named.filter((entry) => {
				return entry.name.toLowerCase().includes(wanted);
			});
	}, [ named, search ]);

	// A template narrowed out of the list is a template that is no longer chosen, so that what is pressed and what is read can
	// never be two different things
	const chosen = matching.find((entry) => {
		return entry.template.id === chosenId;
	})?.template;

	return (
		<FormDialog
			title={t('import.uploadTitle')}
			canSave={chosen !== undefined}
			saveLabel={t('import.uploadChooseFile')}
			onSave={() => {
				if(chosen) {
					onChoose(chosen);
				}
			}}
			onCancel={onCancel}>
			<FormField label={t('import.template')} hint={t('import.templateNote')}>
				<TextField
					value={search}
					label={t('import.templateSearch')}
					placeholder={t('import.templateSearchPlaceholder')}
					onChange={setSearch}/>
				{/* The box is the same height whatever the search leaves in it, so the panel never grows or shrinks under the hands */}
				<div className='import-template-list'>
					{matching.length === 0 ?
						<p className='import-template-empty'>{t('import.templateNoMatch', { search: search.trim() })}</p> :
						<ul className='import-template-entries'>
							{matching.map((entry) => {
								return (
									<li key={entry.template.id}>
										<button
											type='button'
											className='import-template-entry'
											aria-pressed={entry.template.id === chosenId}
											onClick={() => {
												setChosenId(entry.template.id);
											}}>
											{entry.name}
										</button>
									</li>
								);
							})}
						</ul>}
				</div>
			</FormField>
		</FormDialog>
	);
};
