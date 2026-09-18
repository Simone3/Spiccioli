import 'src/components/import/BulkImportScreen.css';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { AppButton, AppLinkButton } from 'src/components/common/AppButton';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { EmptyState } from 'src/components/common/EmptyState';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { ImportPreviewTable } from 'src/components/import/ImportPreviewTable';
import { TemplateChooserDialog } from 'src/components/import/TemplateChooserDialog';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useHandOverToTransactions } from 'src/components/shell/ScreenHandoff';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter, usePreferences } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { applyImportTemplate, type ImportTemplate } from 'src/logic/import/ImportTemplate';
import { extensionsForImportSource, findImportTemplate, IMPORT_TEMPLATES } from 'src/logic/import/ImportTemplates';
import { separatorsCollide } from 'src/logic/preferences/Preferences';
import {
	buildImportedTransactions,
	defaultImportSelection,
	findImportDuplicates,
	importedPeriod,
	isReadImportRow,
	parseImportRows,
	type ImportFormat
} from 'src/logic/transactions/TransactionImport';
import {
	DATE_FORMATS,
	DECIMAL_SEPARATORS,
	THOUSANDS_SEPARATORS,
	type DateFormat,
	type DecimalSeparator,
	type ThousandsSeparator
} from 'src/types/PreferencesTypes';
import { CASH_ACCOUNT_TYPES, type LedgerId, type Transaction } from 'src/types/LedgerTypes';
import type { ImportFileRefusal } from 'src/types/ImportIpcTypes';

/**
 * Bulk import: one screen, one job, and the only text the application parses.
 *
 * **The paste box, the three format controls and the consequences of the paste are on screen together.** The row count, the
 * preview, the duplicate flags and the count on *Import* all follow the paste as it is typed and the controls as they are
 * changed; there is no *Continue*, no review step and no way back — a mis-shaped paste is corrected where it was made.
 *
 * **The three controls belong to the paste and not to the preferences.** They open at what the preferences currently hold,
 * changing one changes nothing on Settings, and the next import opens at the preferences again.
 *
 * **The user lands on Transactions afterwards**, filtered to the account imported into and to the days the rows cover — the
 * ordinary screen with two filters set, where a wrong category is fixed in place. Nothing here previews a categorisation.
 *
 * **A file fills the box and never bypasses it.** *Upload* asks which export is being read, reads it, and writes its rows into
 * the paste box with the three controls moved to what that template declares; everything after that is this screen unchanged.
 * A file the template cannot read at all is refused here with the box left as it was, and a row it read that the screen cannot
 * is an ordinary marked row in the preview.
 */

// The three columns, in the one order every import reads
const EXPECTED_COLUMNS = [ 'date', 'description', 'amountSigned' ] as const;

/**
 * The Bulk import screen.
 * @returns The screen.
 */
export const BulkImportScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { preferences } = usePreferences();
	const formatter = useFormatter();
	const { document, updateDocument } = useLedger();
	const handOverToTransactions = useHandOverToTransactions();
	const [ accountId, setAccountId ] = useState<LedgerId | undefined>(undefined);
	const [ pasted, setPasted ] = useState('');
	const [ selection, setSelection ] = useState<ReadonlySet<number>>(new Set<number>());
	const [ separatorRefusal, setSeparatorRefusal ] = useState<'decimal' | 'thousands' | undefined>(undefined);

	// Undefined until a control is changed, which is what keeps the screen opening at whatever the preferences currently hold
	const [ chosenFormat, setChosenFormat ] = useState<ImportFormat | undefined>(undefined);

	// What the upload is doing: which panel is up, which template it is waiting on an answer about, and what the last attempt
	// left behind. None of it is remembered — an upload is something the screen is doing, not something it is showing.
	const [ templateDialogOpen, setTemplateDialogOpen ] = useState(false);
	const [ templateToReplaceWith, setTemplateToReplaceWith ] = useState<ImportTemplate | undefined>(undefined);
	const [ reading, setReading ] = useState(false);
	const [ uploadRefusal, setUploadRefusal ] = useState<string | undefined>(undefined);
	const [ uploaded, setUploaded ] = useState<{ fileName: string; rowCount: number } | undefined>(undefined);

	const format = useMemo((): ImportFormat => {
		return chosenFormat ?? {
			dateFormat: preferences.dateFormat,
			decimalSeparator: preferences.decimalSeparator,
			thousandsSeparator: preferences.thousandsSeparator
		};
	}, [ chosenFormat, preferences ]);

	const transactions = useMemo(() => {
		return document?.transactions ?? [];
	}, [ document ]);

	const rows = useMemo(() => {
		return parseImportRows(pasted, format);
	}, [ format, pasted ]);

	const duplicates = useMemo(() => {
		return findImportDuplicates({ rows, transactions, accountId });
	}, [ accountId, rows, transactions ]);

	// Reading the rows again is what decides the ticks: the rows a change produced are not the rows the previous ticks were about
	const arrivingSelection = useMemo(() => {
		return defaultImportSelection(rows, duplicates);
	}, [ duplicates, rows ]);

	useEffect(() => {
		setSelection(arrivingSelection);
	}, [ arrivingSelection ]);

	const hasCashAccount = document?.accounts.some((account) => {
		return CASH_ACCOUNT_TYPES.includes(account.type);
	}) ?? false;

	const unreadableCount = rows.filter((row) => {
		return !isReadImportRow(row);
	}).length;

	const dateFormatOptions: readonly SelectOption<DateFormat>[] = DATE_FORMATS.map((dateFormat) => {
		return { value: dateFormat, label: dateFormat };
	});

	const decimalSeparatorOptions: readonly SelectOption<DecimalSeparator>[] = DECIMAL_SEPARATORS.map((separator) => {
		return { value: separator, label: t(`settings.separators.${separator}`) };
	});

	const thousandsSeparatorOptions: readonly SelectOption<ThousandsSeparator>[] = THOUSANDS_SEPARATORS.map((separator) => {
		return { value: separator, label: t(`settings.separators.${separator}`) };
	});

	const changeDecimalSeparator = (decimalSeparator: DecimalSeparator): void => {
		if(separatorsCollide(decimalSeparator, format.thousandsSeparator)) {
			setSeparatorRefusal('decimal');

			return;
		}

		setSeparatorRefusal(undefined);
		setChosenFormat({ ...format, decimalSeparator });
	};

	const changeThousandsSeparator = (thousandsSeparator: ThousandsSeparator): void => {
		if(separatorsCollide(thousandsSeparator, format.decimalSeparator)) {
			setSeparatorRefusal('thousands');

			return;
		}

		setSeparatorRefusal(undefined);
		setChosenFormat({ ...format, thousandsSeparator });
	};

	const refusalMessage = (refusal: ImportFileRefusal): string => {
		if(refusal.reason === 'sheet-missing') {
			return t('import.uploadRefusal.sheetMissing', { sheet: refusal.sheet });
		}

		if(refusal.reason === 'not-a-workbook' || refusal.reason === 'not-a-pdf') {
			// No template on this screen reads a PDF, so the second of them is here to be exhaustive rather than to be shown
			return t(refusal.reason === 'not-a-workbook' ? 'import.uploadRefusal.notAWorkbook' : 'import.uploadRefusal.notAPdf');
		}

		return t(`import.uploadRefusal.${refusal.reason}`);
	};

	/**
	 * Reads one export under one template, and fills the box with what it holds.
	 *
	 * **The box and the three controls move together or not at all**: a file that could not be read leaves both as they were and
	 * says why, and a file that could leaves the controls at what the template declares — which is what makes the rows it just
	 * wrote readable without touching anything.
	 * @param template The template the user chose.
	 */
	const readWithTemplate = async(template: ImportTemplate): Promise<void> => {
		setTemplateDialogOpen(false);
		setTemplateToReplaceWith(undefined);
		setUploadRefusal(undefined);
		setReading(true);

		try {
			const result = await window.spiccioliImport.readFile({
				source: template.source,
				scope: 'transactions',
				fileTypeName: t(`import.fileTypes.${template.source.kind}`),
				extensions: extensionsForImportSource(template.source),
				dialogTitle: t('import.uploadDialogTitle')
			});

			if(result.outcome === 'cancelled') {
				return;
			}

			if(result.outcome === 'refused') {
				setUploadRefusal(refusalMessage(result.refusal));

				return;
			}

			const applied = applyImportTemplate(result.rows, template);

			if(applied.outcome === 'refused') {
				setUploadRefusal(applied.refusal.reason === 'column-missing' ?
					t('import.uploadRefusal.columnMissing', { label: applied.refusal.label }) :
					t(`import.uploadRefusal.${applied.refusal.reason === 'header-missing' ? 'headerMissing' : 'noRows'}`));

				return;
			}

			setChosenFormat(template.format);
			setSeparatorRefusal(undefined);
			setPasted(applied.text);
			setUploaded({ fileName: result.fileName, rowCount: applied.rowCount });
		}
		finally {
			setReading(false);
		}
	};

	// The list the chooser shows, named out of the translation bundle: a template carries an id and never its own name
	const templateChoices = IMPORT_TEMPLATES.map((template) => {
		return { id: template.id, name: t(`import.templates.${template.id}.name`) };
	});

	// Filling a box that already holds something replaces it, so the question is asked before the chooser opens rather than
	// after a file has been read and there is nothing left to go back to
	const chooseTemplate = (template: ImportTemplate): void => {
		if(pasted.trim() === '') {
			void readWithTemplate(template);

			return;
		}

		setTemplateDialogOpen(false);
		setTemplateToReplaceWith(template);
	};

	const chooseTemplateById = (id: string): void => {
		const template = findImportTemplate(id);

		if(template) {
			chooseTemplate(template);
		}
	};

	const toggleRow = (line: number): void => {
		const next = new Set(selection);

		if(!next.delete(line)) {
			next.add(line);
		}

		setSelection(next);
	};

	// Nothing is written until here, and what is written is the ticked rows in the order they were pasted.
	// **The rows are built inside the update**: they take consecutive insertion sequences counted from the file they are going
	// into, and counting them off the file this render is showing would hand the paste sequences another row already holds.
	const runImport = (): void => {
		if(accountId === undefined || selection.size === 0) {
			return;
		}

		let imported: readonly Transaction[] = [];

		updateDocument((current) => {
			imported = buildImportedTransactions({ rows, selection, accountId, transactions: current.transactions, rules: current.rules });

			return { ...current, transactions: [ ...current.transactions, ...imported ] };
		});

		const period = importedPeriod(imported);

		if(!period) {
			return;
		}

		handOverToTransactions({ accountId, fromDate: period.fromDate, toDate: period.toDate });
	};

	const summaryParts = {
		pasted: t('import.rowCount', { count: rows.length }),
		selected: t('import.selectedCount', { count: selection.size }),
		duplicates: t('import.duplicateCount', { count: duplicates.size }),
		unreadable: t('import.unreadableCount', { count: unreadableCount })
	};

	const summaryKey = (): 'import.summary' | 'import.summaryWithDuplicates' | 'import.summaryWithUnreadable' | 'import.summaryWithBoth' => {
		if(duplicates.size > 0 && unreadableCount > 0) {
			return 'import.summaryWithBoth';
		}

		if(duplicates.size > 0) {
			return 'import.summaryWithDuplicates';
		}

		return unreadableCount > 0 ? 'import.summaryWithUnreadable' : 'import.summary';
	};

	const outcomeFigures: readonly { key: string; label: string; value: number; tone: string }[] = [
		{ key: 'pasted', label: t('import.outcomePasted'), value: rows.length, tone: '' },
		{ key: 'selected', label: t('import.outcomeSelected'), value: selection.size, tone: ' bulk-import-screen-new' },
		{ key: 'duplicates', label: t('import.outcomeDuplicates'), value: duplicates.size, tone: ' bulk-import-screen-refused' },
		{ key: 'unreadable', label: t('import.outcomeUnreadable'), value: unreadableCount, tone: ' bulk-import-screen-refused' }
	];

	const actions = (
		<>
			<AppLinkButton variant='ghost' to={APP_ROUTES.transactions}>{t('import.cancel')}</AppLinkButton>
			<AppButton
				variant='primary'
				disabled={accountId === undefined || selection.size === 0}
				onClick={runImport}>
				{t('import.action', { count: selection.size })}
			</AppButton>
		</>
	);

	if(!hasCashAccount) {
		return (
			<ScreenLayout title={t('screens.bulkImport')}>
				<EmptyState message={t('emptyState.bulkImport')}>
					<AppLinkButton to={APP_ROUTES.accounts} variant='primary'>{t('emptyState.goToAccounts')}</AppLinkButton>
				</EmptyState>
			</ScreenLayout>
		);
	}

	return (
		<ScreenLayout
			title={t('screens.bulkImport')}
			subtitle={rows.length === 0 ? undefined : t(summaryKey(), summaryParts)}
			actions={actions}>
			<div className='bulk-import-screen-columns'>
				<section className='bulk-import-screen-card'>
					<div className='bulk-import-screen-card-header'>
						<h2 className='bulk-import-screen-card-title'>{t('import.pasteTitle')}</h2>
						<AppButton
							disabled={reading}
							onClick={() => {
								setUploadRefusal(undefined);
								setTemplateDialogOpen(true);
							}}>
							{reading ? t('import.uploadReading') : t('import.upload')}
						</AppButton>
					</div>
					{uploaded && (
						<p className='bulk-import-screen-uploaded'>
							{t('import.uploadedNotice', { fileName: uploaded.fileName, count: uploaded.rowCount })}
						</p>
					)}
					{uploadRefusal !== undefined && <p className='bulk-import-screen-warning'>{uploadRefusal}</p>}
					<textarea
						className='bulk-import-screen-paste'
						value={pasted}
						spellCheck={false}
						placeholder={t('import.pastePlaceholder')}
						aria-label={t('import.pasteLabel')}
						onChange={(event) => {
							setPasted(event.target.value);
						}}/>

					<h2 className='bulk-import-screen-card-title'>{t('import.formatTitle')}</h2>
					<div className='bulk-import-screen-fields'>
						<span className='bulk-import-screen-field-label'>{t('import.dateFormat')}</span>
						<SelectField
							value={format.dateFormat}
							options={dateFormatOptions}
							label={t('import.dateFormat')}
							onChange={(dateFormat) => {
								setChosenFormat({ ...format, dateFormat });
							}}/>
						<span className='bulk-import-screen-field-label'>{t('import.decimalSeparator')}</span>
						<SelectField
							value={format.decimalSeparator}
							options={decimalSeparatorOptions}
							label={t('import.decimalSeparator')}
							refusal={separatorRefusal === 'decimal' ? t('settings.separatorsMustDiffer') : undefined}
							onChange={changeDecimalSeparator}/>
						<span className='bulk-import-screen-field-label'>{t('import.thousandsSeparator')}</span>
						<SelectField
							value={format.thousandsSeparator}
							options={thousandsSeparatorOptions}
							label={t('import.thousandsSeparator')}
							refusal={separatorRefusal === 'thousands' ? t('settings.separatorsMustDiffer') : undefined}
							onChange={changeThousandsSeparator}/>
					</div>
					<p className='bulk-import-screen-note'>{t('import.formatNote')}</p>
				</section>

				<section className='bulk-import-screen-card'>
					<h2 className='bulk-import-screen-card-title'>{t('import.accountTitle')}</h2>
					<AccountPicker
						value={accountId}
						side='cash'
						label={t('import.account')}
						placeholder={t('import.accountChoose')}
						onChange={setAccountId}/>
					<p className='bulk-import-screen-note'>{t('import.accountNote')}</p>

					<h2 className='bulk-import-screen-card-title'>{t('import.outcomeTitle')}</h2>
					<dl className='bulk-import-screen-figures'>
						{outcomeFigures.map((figure) => {
							return (
								<div key={figure.key} className='bulk-import-screen-figure'>
									<dt>{figure.label}</dt>
									<dd className={`bulk-import-screen-figure-value${figure.value === 0 ? '' : figure.tone}`}>
										{formatter.integer(figure.value)}
									</dd>
								</div>
							);
						})}
					</dl>

					<h2 className='bulk-import-screen-card-title'>{t('import.columnsTitle')}</h2>
					<ol className='bulk-import-screen-expected'>
						{EXPECTED_COLUMNS.map((column) => {
							return <li key={column}>{t(`import.columns.${column}`)}</li>;
						})}
					</ol>
					<p className='bulk-import-screen-note'>{t('import.columnsNote')}</p>
				</section>
			</div>

			<section className='bulk-import-screen-card'>
				<h2 className='bulk-import-screen-card-title'>{t('import.previewTitle')}</h2>
				{rows.length === 0 ?
					<p className='bulk-import-screen-note'>{t('import.previewEmpty')}</p> :
					<>
						<ImportPreviewTable
							rows={rows}
							duplicates={duplicates}
							selection={selection}
							dateFormat={format.dateFormat}
							onToggleRow={toggleRow}/>
						{duplicates.size > 0 && (
							<p className='bulk-import-screen-warning'>{t('import.duplicateNotice', { count: duplicates.size })}</p>
						)}
						{unreadableCount > 0 && (
							<p className='bulk-import-screen-warning'>{t('import.unreadableNotice', { count: unreadableCount })}</p>
						)}
					</>}
			</section>

			{templateDialogOpen && (
				<TemplateChooserDialog
					title={t('import.uploadTitle')}
					note={t('import.templateNote')}
					searchPlaceholder={t('import.templateSearchPlaceholder')}
					entries={templateChoices}
					onChoose={chooseTemplateById}
					onCancel={() => {
						setTemplateDialogOpen(false);
					}}/>
			)}

			{templateToReplaceWith && (
				<ConfirmDialog
					title={t('import.replaceTitle')}
					message={t('import.replaceMessage', { count: rows.length })}
					confirmLabel={t('import.replaceConfirm')}
					onConfirm={() => {
						void readWithTemplate(templateToReplaceWith);
					}}
					onCancel={() => {
						setTemplateToReplaceWith(undefined);
					}}/>
			)}
		</ScreenLayout>
	);
};
