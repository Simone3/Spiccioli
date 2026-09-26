import { useMemo, useState, type ReactElement } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { FormField } from 'src/components/common/FormDialog';
import { TemplateChooserDialog } from 'src/components/import/TemplateChooserDialog';
import { SecurityForm } from 'src/components/investments/SecurityForm';
import { toSecurity, type SecurityFormValues } from 'src/components/investments/SecurityFields';
import { TradeImportRecap } from 'src/components/investments/TradeImportRecap';
import { useLedger } from 'src/contexts/LedgerContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { formatAccountName, indexInstitutions } from 'src/logic/accounts/Accounts';
import { extensionsForImportSource } from 'src/logic/import/ImportTemplates';
import {
	applyTradeImportTemplate,
	tradeImportReadingOf,
	type TradeImportCells,
	type TradeImportTemplate
} from 'src/logic/import/TradeImportTemplate';
import { findTradeImportTemplate, TRADE_IMPORT_TEMPLATES } from 'src/logic/import/TradeImportTemplates';
import {
	buildImportedTrades,
	buildTradeImportRows,
	defaultTradeImportSelection,
	isWritableTradeImportRow,
	tradeImportSecurityPrefill,
	type CreatedSecurity,
	type TradeImportRow,
	type TradeImportWrite
} from 'src/logic/investments/TradeImport';
import { createLedgerId } from 'src/logic/ledger/LedgerDocument';
import type { ImportFileRefusal } from 'src/types/ImportIpcTypes';
import type { LedgerId, Security } from 'src/types/LedgerTypes';

/**
 * *Import trades…* from beginning to end ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)): the
 * account and the template, the file, the recap, and the security form a row with no security opens.
 *
 * **Nothing is written until the recap's *Import* is pressed**, and then everything is written in one step — the trades and the
 * securities the recap created for them, so the file never holds a trade pointing at nothing, and never a security created for a
 * row that was left unticked.
 *
 * **A security created here belongs to the recap until then.** Every row is read again against it the moment it is created, so a
 * new instrument bought five times is one *Create*, and the rows it resolves arrive ticked like every other writable row.
 */

// What was read, and into what: everything the recap is built from besides what it has created since
interface TradeImportRead {
	template: TradeImportTemplate;
	accountId: LedgerId;
	fileName: string;
	cells: readonly TradeImportCells[];
	dropped: number;
}

export interface TradeImportFlowProps {

	// What the import writes, which the screen puts in the file in one step, with the account it was read into
	onWrite: (written: TradeImportWrite, accountId: LedgerId) => void;

	// A file that could not be read at all, which ends the import with a line on the screen and nothing opened
	onRefused: (message: string) => void;

	onClose: () => void;
}

/**
 * The import.
 * @param props The import's props.
 * @param props.onWrite What writing the ticked rows does.
 * @param props.onRefused What a file that cannot be read at all does.
 * @param props.onClose What leaving without writing does.
 * @returns Whichever of its panels is up.
 */
export const TradeImportFlow = ({ onWrite, onRefused, onClose }: TradeImportFlowProps): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const { document } = useLedger();

	// The account and the template open unchosen every time, like every picker in the application
	const [ accountId, setAccountId ] = useState<LedgerId | undefined>(undefined);
	const [ reading, setReading ] = useState(false);
	const [ read, setRead ] = useState<TradeImportRead | undefined>(undefined);
	const [ created, setCreated ] = useState<readonly CreatedSecurity[]>([]);
	const [ ticked, setTicked ] = useState<ReadonlySet<string>>(new Set());
	const [ creatingFor, setCreatingFor ] = useState<TradeImportRow | undefined>(undefined);

	const today = DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());

	// The rows are read again whenever the recap creates a security, which is what resolves every row that names it at once
	const rowsFor = (from: TradeImportRead, withCreated: readonly CreatedSecurity[]): readonly TradeImportRow[] => {
		return buildTradeImportRows({
			cells: from.cells,
			reading: tradeImportReadingOf(from.template),
			accountId: from.accountId,
			securities: document?.securities ?? [],
			trades: document?.trades ?? [],
			created: withCreated,
			today
		});
	};

	const rows = read ? rowsFor(read, created) : [];

	const securities = useMemo((): ReadonlyMap<LedgerId, Security> => {
		return new Map([ ...document?.securities ?? [], ...created.map((entry) => {
			return entry.security;
		}) ].map((security) => {
			return [ security.id, security ];
		}));
	}, [ created, document ]);

	const templateChoices = TRADE_IMPORT_TEMPLATES.map((template) => {
		return { id: template.id, name: t(`trades.import.templates.${template.id}.name`) };
	});

	const fileRefusalMessage = (refusal: ImportFileRefusal): string => {
		if(refusal.reason === 'sheet-missing') {
			return t('import.uploadRefusal.sheetMissing', { sheet: refusal.sheet });
		}

		if(refusal.reason === 'not-a-workbook' || refusal.reason === 'not-a-pdf') {
			// No broker template reads a PDF, so the second of them is here to be exhaustive rather than to be shown
			return t(refusal.reason === 'not-a-workbook' ? 'import.uploadRefusal.notAWorkbook' : 'import.uploadRefusal.notAPdf');
		}

		return t(`import.uploadRefusal.${refusal.reason}`);
	};

	/**
	 * Reads the export under the template chosen, into the account chosen, and opens the recap on it.
	 *
	 * **Nothing is written here**, and a file that cannot be read at all ends the import with a line saying why.
	 * @param id The template the user chose.
	 */
	const readExport = async(id: string): Promise<void> => {
		const template = findTradeImportTemplate(id);

		if(!template || accountId === undefined) {
			return;
		}

		setReading(true);

		try {
			const result = await window.spiccioliImport.readFile({
				source: template.source,
				scope: 'trades',
				fileTypeName: t(`import.fileTypes.${template.source.kind}`),
				extensions: extensionsForImportSource(template.source),
				dialogTitle: t('trades.import.dialogTitle')
			});

			if(result.outcome === 'cancelled') {
				return;
			}

			if(result.outcome === 'refused') {
				onRefused(fileRefusalMessage(result.refusal));

				return;
			}

			const applied = applyTradeImportTemplate(result.rows, template);

			if(applied.outcome === 'refused') {
				onRefused(applied.refusal.reason === 'column-missing' ?
					t('import.uploadRefusal.columnMissing', { label: applied.refusal.label }) :
					t(`import.uploadRefusal.${applied.refusal.reason === 'header-missing' ? 'headerMissing' : 'noRows'}`));

				return;
			}

			const opened: TradeImportRead = { template, accountId, fileName: result.fileName, cells: applied.rows, dropped: applied.dropped };

			setRead(opened);
			setCreated([]);
			setTicked(defaultTradeImportSelection(rowsFor(opened, [])));
		}
		finally {
			setReading(false);
		}
	};

	/**
	 * Takes the security a row's form was saved with into the recap, and ticks every row it has just made writable.
	 * @param row The row the form was opened from.
	 * @param values What the form was saved with.
	 */
	const createSecurity = (row: TradeImportRow, values: SecurityFormValues): void => {
		setCreatingFor(undefined);

		if(!read) {
			return;
		}

		const next = [ ...created, { security: toSecurity(values, createLedgerId()), rowKey: row.key } ];
		const before = defaultTradeImportSelection(rows);
		const resolved = [ ...defaultTradeImportSelection(rowsFor(read, next)) ].filter((key) => {
			return !before.has(key);
		});

		setCreated(next);
		setTicked((current) => {
			return new Set([ ...current, ...resolved ]);
		});
	};

	const toggle = (key: string): void => {
		setTicked((current) => {
			const next = new Set(current);

			if(!next.delete(key)) {
				next.add(key);
			}

			return next;
		});
	};

	if(!read) {
		// The chooser stays up while the file is read, the press that opened the file chooser being the one it answers
		return (
			<TemplateChooserDialog
				title={t('trades.import.title')}
				note={t('trades.import.templateNote')}
				searchPlaceholder={t('trades.import.templateSearchPlaceholder')}
				chooseLabel={reading ? t('trades.import.reading') : undefined}
				entries={templateChoices}
				ready={accountId !== undefined && !reading}
				onChoose={(id) => {
					void readExport(id);
				}}
				onCancel={onClose}>
				<FormField label={t('trades.import.account')}>
					<AccountPicker
						side='brokerage'
						value={accountId}
						label={t('trades.import.account')}
						placeholder={t('trades.import.accountChoose')}
						onChange={setAccountId}/>
				</FormField>
			</TemplateChooserDialog>
		);
	}

	const account = document?.accounts.find((candidate) => {
		return candidate.id === read.accountId;
	});
	const accountName = account ? formatAccountName(account, indexInstitutions(document?.institutions ?? []), translator) : '';

	return (
		<>
			<TradeImportRecap
				accountName={accountName}
				templateName={t(`trades.import.templates.${read.template.id}.name`)}
				fileName={read.fileName}
				dateFormat={read.template.format.dateFormat}
				rows={rows}
				dropped={read.dropped}
				securities={securities}
				ticked={ticked}
				onToggle={toggle}
				onTickAll={(all) => {
					// The two selectors set the whole selection rather than adding to it, and reach every row that can be written
					const writable = rows.filter(isWritableTradeImportRow).map((row) => {
						return row.key;
					});

					setTicked(new Set(all ? writable : []));
				}}
				onCreateSecurity={setCreatingFor}
				onCancel={onClose}
				onSave={() => {
					onWrite(buildImportedTrades({ rows, ticked, accountId: read.accountId, trades: document?.trades ?? [], created }), read.accountId);
				}}/>

			{creatingFor && (
				<SecurityForm
					security={undefined}
					prefill={tradeImportSecurityPrefill(creatingFor)}
					subtitle={t('trades.import.recap.createSecuritySubtitle', { line: creatingFor.cells.line, fileName: read.fileName })}
					pending={created.map((entry) => {
						return entry.security;
					})}
					onSave={(values) => {
						createSecurity(creatingFor, values);
					}}
					onCancel={() => {
						setCreatingFor(undefined);
					}}/>
			)}
		</>
	);
};
