import 'src/components/import/TemplateChooserDialog.css';
import { useMemo, useState, type ReactElement } from 'react';
import { FormDialog, FormField } from 'src/components/common/FormDialog';
import { TextField } from 'src/components/common/TextField';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * Which document is about to be read, asked before the file chooser opens.
 *
 * **The template is chosen first and the file second**, because the template is what says how to read the file: a workbook — or
 * a payslip — handed over with nothing said about it is a file nothing can do anything with. It opens unchosen every time, like
 * every other picker in the application.
 *
 * **The templates are a list narrowed by typing rather than a picker.** One bank may have several, and a picker of a few dozen
 * is a picker nobody reads to the end of — where typing a name leaves the two or three entries that could be meant. **Typing
 * narrows and never chooses**: a template is chosen by pressing it, so a search that happens to leave one entry still takes the
 * press that says it was the one meant.
 *
 * **It knows nothing about what a template reads.** Both imports show the same list of names and get back the one that was
 * pressed; which of them is a bank export and which is a payslip is the screen's business and never this dialog's.
 */

// One entry of the list: what is pressed, and what it says
export interface TemplateChoice {
	id: string;
	name: string;
}

export interface TemplateChooserDialogProps {
	title: string;

	// What the list is of, above the search box: "Pick a template for your bank export."
	note: string;

	// What the search box suggests typing, which is what the names in this list are made of
	searchPlaceholder: string;

	// What the button that opens the file chooser says, where "Choose file…" would be saying the wrong number of them
	chooseLabel?: string;

	entries: readonly TemplateChoice[];

	// Called with the id of the template chosen, which is what opens the file chooser
	onChoose: (id: string) => void;

	onCancel: () => void;
}

/**
 * The template picker.
 * @param props The dialog's props.
 * @param props.title What the panel is called.
 * @param props.note What the list is of.
 * @param props.searchPlaceholder What the search box suggests typing.
 * @param props.chooseLabel What the button that opens the file chooser says.
 * @param props.entries The templates offered.
 * @param props.onChoose What to do with the template chosen.
 * @param props.onCancel What cancelling does.
 * @returns The dialog.
 */
export const TemplateChooserDialog = ({
	title,
	note,
	searchPlaceholder,
	chooseLabel,
	entries,
	onChoose,
	onCancel
}: TemplateChooserDialogProps): ReactElement => {
	const { t } = useTranslator();
	const [ search, setSearch ] = useState('');
	const [ chosenId, setChosenId ] = useState<string | undefined>(undefined);

	const matching = useMemo(() => {
		const wanted = search.trim().toLowerCase();

		return wanted === '' ?
			entries :
			entries.filter((entry) => {
				return entry.name.toLowerCase().includes(wanted);
			});
	}, [ entries, search ]);

	// A template narrowed out of the list is a template that is no longer chosen, so that what is pressed and what is read can
	// never be two different things
	const chosen = matching.find((entry) => {
		return entry.id === chosenId;
	});

	return (
		<FormDialog
			title={title}
			canSave={chosen !== undefined}
			saveLabel={chooseLabel ?? t('import.uploadChooseFile')}
			onSave={() => {
				if(chosen) {
					onChoose(chosen.id);
				}
			}}
			onCancel={onCancel}>
			<FormField label={t('import.template')} hint={note}>
				<TextField
					value={search}
					label={t('import.templateSearch')}
					placeholder={searchPlaceholder}
					onChange={setSearch}/>
				{/* The box is the same height whatever the search leaves in it, so the panel never grows or shrinks under the hands */}
				<div className='import-template-list'>
					{matching.length === 0 ?
						<p className='import-template-empty'>{t('import.templateNoMatch', { search: search.trim() })}</p> :
						<ul className='import-template-entries'>
							{matching.map((entry) => {
								return (
									<li key={entry.id}>
										<button
											type='button'
											className='import-template-entry'
											aria-pressed={entry.id === chosenId}
											onClick={() => {
												setChosenId(entry.id);
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
