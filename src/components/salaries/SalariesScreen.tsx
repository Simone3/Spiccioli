import 'src/components/salaries/SalariesScreen.css';
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { EmptyState } from 'src/components/common/EmptyState';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TabBar } from 'src/components/common/TabBar';
import { TemplateChooserDialog } from 'src/components/import/TemplateChooserDialog';
import { ContractForm, type ContractFormValues } from 'src/components/salaries/ContractForm';
import { ContractsTable } from 'src/components/salaries/ContractsTable';
import { ContractYearsTable } from 'src/components/salaries/ContractYearsTable';
import { PayslipForm, type PayslipFormValues } from 'src/components/salaries/PayslipForm';
import { PayslipImportRecap } from 'src/components/salaries/PayslipImportRecap';
import { formatPayslipMonth, PayslipsTable } from 'src/components/salaries/PayslipsTable';
import { SalaryCharts } from 'src/components/salaries/SalaryCharts';
import { WorkingDaysForm } from 'src/components/salaries/WorkingDaysForm';
import { useSalariesHandoff } from 'src/components/shell/ScreenHandoff';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useRemembered } from 'src/contexts/ScreenMemoryContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { extensionsForImportSource } from 'src/logic/import/ImportTemplates';
import {
	applyPayslipTemplate,
	payslipLinesOf,
	type PayslipFigure,
	type PayslipImportValues,
	type PayslipTemplate,
	type PayslipTemplateId
} from 'src/logic/import/PayslipTemplate';
import { findPayslipTemplate, PAYSLIP_TEMPLATES } from 'src/logic/import/PayslipTemplates';
import { createLedgerId } from 'src/logic/ledger/LedgerDocument';
import { formatMinorUnitsAsPlainDecimal, MONEY_SCALES } from 'src/logic/money/Money';
import { countPayslipsPerContract, contractYearRange, sortContracts } from 'src/logic/salaries/Contracts';
import { buildPayslipBatch, defaultPayslipSelection, isWritablePayslipRow, type PayslipBatchRow } from 'src/logic/salaries/PayslipImportBatch';
import { netSalary, payslipsOfContract, sortPayslipsOfYear } from 'src/logic/salaries/Payslips';
import { deriveSalaryYears, type SalaryChartWindow, type SalaryYearFigures } from 'src/logic/salaries/SalaryFigures';
import type { ImportFileOutcome, ImportFileRefusal } from 'src/types/ImportIpcTypes';
import type { Contract, ContractYear, LedgerId, Payslip } from 'src/types/LedgerTypes';

/**
 * Salaries: the contracts and the payslips that divide by them.
 *
 * **The contract selector scopes the whole of the Payslips tab.** Every table and both charts cover the selected contract only,
 * **no figure anywhere sums across contracts**, and there is no cross-contract comparison — which is why ending a contract
 * changes no total and why a contract is never retired, only ended.
 *
 * **Two selections drive the tab and both are always made**: a contract, and a year within it. The year is the contract's last
 * one on arriving, and it follows a payslip saved into another year so that the new row is visible where it landed.
 *
 * **`Working days` is the ContractYear record and not a report of one.** The cell opens the form that is the whole of it: a
 * number creates the record and an empty field deletes it, which is the one delete in the application that is not confirmed —
 * it puts the year back exactly where it was.
 *
 * **A payslip document is read onto the form and never into the file.** *Import payslip* asks which template, reads the
 * document under it, and opens the ordinary *Add payslip* form with what it found already in the fields — so the one way a
 * payslip is written is still somebody pressing *Save* on that form, with every figure visible beside its own label.
 *
 * **Several documents at once open the recap instead**, which is a list and not a form: every document has a row stating the
 * payslip it would write, a row that cannot be written says why and cannot be ticked, and *Save* writes the ticked rows in one
 * go. Nothing is written by either path without somebody pressing *Save* on what they can see.
 */

type SalariesTab = 'payslips' | 'contracts';

// The record a form is open on. An undefined record is one being created; an undefined draft is a form that is not open.
interface ContractDraft {
	contract: Contract | undefined;
}

// The recap a selection of several documents is read into: what it would write, and which template read it
interface PayslipBatch {
	templateId: PayslipTemplateId;
	rows: readonly PayslipBatchRow[];
}

interface PayslipDraft {
	payslip: Payslip | undefined;

	// What a document was read as, where the form is being opened from one
	prefill?: PayslipImportValues;

	// What the form says about itself above its first field, where it did not open empty
	notice?: string;
}

/**
 * The Salaries screen.
 * @returns The screen.
 */
export const SalariesScreen = (): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const { document, updateDocument } = useLedger();

	// The tab, the contract the screen is scoped to and the year selected under it are what it is found showing ([§12.2])
	const [ tab, setTab ] = useRemembered<SalariesTab>('salaries', 'tab', 'payslips');
	const [ chosenContractId, setChosenContractId ] = useRemembered<LedgerId | undefined>('salaries', 'contract', undefined);
	const [ chosenYear, setChosenYear ] = useRemembered<number | undefined>('salaries', 'year', undefined);

	// The two charts share one window, and five years is where it opens ([§8.1])
	const [ chartWindow, setChartWindow ] = useRemembered<SalaryChartWindow>('salaries', 'chartWindow', 'last-5');
	const [ contractDraft, setContractDraft ] = useState<ContractDraft | undefined>(undefined);
	const [ payslipDraft, setPayslipDraft ] = useState<PayslipDraft | undefined>(undefined);
	const [ contractToDelete, setContractToDelete ] = useState<Contract | undefined>(undefined);
	const [ payslipToDelete, setPayslipToDelete ] = useState<Payslip | undefined>(undefined);
	const [ workingDaysDraft, setWorkingDaysDraft ] = useState<SalaryYearFigures | undefined>(undefined);
	const [ refusal, setRefusal ] = useState<string | undefined>(undefined);
	const [ templateDialogOpen, setTemplateDialogOpen ] = useState(false);
	const [ reading, setReading ] = useState(false);

	// The recap a selection of several documents opened, and the rows of it that will be written
	const [ batch, setBatch ] = useState<PayslipBatch | undefined>(undefined);
	const [ tickedRows, setTickedRows ] = useState<ReadonlySet<string>>(new Set());

	const today = DateUtils.toStandardYearMonthDay(DateUtils.startOfToday());

	// A check entry naming a payslip arrives with the contract and the year it is under, which is the pair this tab is scoped by
	const handoff = useSalariesHandoff();

	useEffect(() => {
		if(!handoff) {
			return;
		}

		setTab('payslips');
		setChosenContractId(handoff.contractId);
		setChosenYear(handoff.year);
	}, [ handoff, setChosenContractId, setChosenYear, setTab ]);

	const contracts = useMemo(() => {
		return sortContracts(document?.contracts ?? []);
	}, [ document ]);

	const payslipCounts = useMemo((): ReadonlyMap<LedgerId, number> => {
		return document ? countPayslipsPerContract(document) : new Map<LedgerId, number>();
	}, [ document ]);

	// The selection is resolved rather than kept in step: a contract deleted under it falls back to the latest one there is
	const selectedContract = contracts.find((contract) => {
		return contract.id === chosenContractId;
	}) ?? contracts[contracts.length - 1];

	const years = useMemo(() => {
		return selectedContract ?
			deriveSalaryYears({
				contract: selectedContract,
				payslips: document?.payslips ?? [],
				contractYears: document?.contractYears ?? [],
				today
			}) :
			[];
	}, [ document, selectedContract, today ]);

	// A row of the per-year table is always selected: on first arriving it is the contract's last year, and on coming back the
	// row that was selected when the screen was left, a year the contract no longer covers falling back to the last one again
	const isChosenYearCovered = years.some((row) => {
		return row.year === chosenYear;
	});

	const selectedYear = isChosenYearCovered ? chosenYear : years[years.length - 1]?.year;

	const payslipsOfYear = useMemo(() => {
		if(!selectedContract || selectedYear === undefined) {
			return [];
		}

		return sortPayslipsOfYear(payslipsOfContract(document?.payslips ?? [], selectedContract.id).filter((payslip) => {
			return payslip.year === selectedYear;
		}));
	}, [ document, selectedContract, selectedYear ]);

	const selectedContractPayslipCount = selectedContract ? payslipCounts.get(selectedContract.id) ?? 0 : 0;

	const selectContract = (contract: Contract): void => {
		setRefusal(undefined);
		setChosenContractId(contract.id);

		// The year belongs to the contract that was showing, so it goes back to the new contract's last one
		setChosenYear(undefined);
		setTab('payslips');
	};

	const saveContract = (values: ContractFormValues): void => {
		const existing = contractDraft?.contract;

		updateDocument((current) => {
			return {
				...current,
				contracts: existing ?
					current.contracts.map((contract) => {
						return contract.id === existing.id ? { ...existing, ...values } : contract;
					}) :
					[ ...current.contracts, { id: createLedgerId(), ...values } ]
			};
		});
		setContractDraft(undefined);
	};

	// A contract is blocked by the payslips pointing at it, and by nothing else: its years go with it
	const requestContractDeletion = (contract: Contract): void => {
		const count = payslipCounts.get(contract.id) ?? 0;

		if(count > 0) {
			setRefusal(t('contracts.deleteBlocked', { name: contract.name, count }));

			return;
		}

		setRefusal(undefined);
		setContractToDelete(contract);
	};

	const deleteContract = (contract: Contract): void => {
		updateDocument((current) => {
			return {
				...current,
				contracts: current.contracts.filter((candidate) => {
					return candidate.id !== contract.id;
				}),
				contractYears: current.contractYears.filter((contractYear) => {
					return contractYear.contractId !== contract.id;
				})
			};
		});
		setContractToDelete(undefined);
	};

	/**
	 * Writes the ContractYear the form **is**, or deletes it where the form was saved empty.
	 *
	 * An empty field puts the year back exactly where it was before anything was entered, which is why the record goes rather
	 * than being written as a zero. The field itself refuses everything outside 1 – 366 as it is typed, so nothing reaches here
	 * that has to be refused again.
	 * @param year The year the record belongs to.
	 * @param workingDays What was entered, or undefined where the field was left empty.
	 */
	const writeWorkingDays = (year: number, workingDays: number | undefined): void => {
		setWorkingDaysDraft(undefined);

		if(!selectedContract) {
			return;
		}

		const contractId = selectedContract.id;

		updateDocument((current) => {
			const others = current.contractYears.filter((contractYear) => {
				return contractYear.contractId !== contractId || contractYear.year !== year;
			});

			if(workingDays === undefined) {
				return { ...current, contractYears: others };
			}

			const written: ContractYear = { contractId, year, workingDays };

			return { ...current, contractYears: [ ...others, written ] };
		});
	};

	const savePayslip = (values: PayslipFormValues): void => {
		if(!selectedContract) {
			return;
		}

		const existing = payslipDraft?.payslip;
		const contractId = selectedContract.id;

		updateDocument((current) => {
			return {
				...current,
				payslips: existing ?
					current.payslips.map((payslip) => {
						return payslip.id === existing.id ? { ...existing, ...values } : payslip;
					}) :
					[ ...current.payslips, { id: createLedgerId(), contractId, ...values } ]
			};
		});

		// Saving into a year other than the selected one moves the selection to it, so the row is visible where it landed
		setChosenYear(values.year);
		setPayslipDraft(undefined);
	};

	// A copy is valid where it lands, a month legitimately holding more than one payslip, so it is written rather than offered on a form
	const duplicatePayslip = (payslip: Payslip): void => {
		updateDocument((current) => {
			return { ...current, payslips: [ ...current.payslips, { ...payslip, id: createLedgerId() } ] };
		});
	};

	const deletePayslip = (payslip: Payslip): void => {
		updateDocument((current) => {
			return {
				...current,
				payslips: current.payslips.filter((candidate) => {
					return candidate.id !== payslip.id;
				})
			};
		});
		setPayslipToDelete(undefined);
	};

	const monthOf = (payslip: Payslip): string => {
		return formatPayslipMonth(payslip, (month, year) => {
			return t('payslips.monthOfYear', { month, year });
		});
	};

	// The terms every figure on this tab divides by, stated where the figures are rather than only on the tab that sets them
	const contractTerms = (contract: Contract): string => {
		return t('contracts.terms', {
			name: contract.name,
			months: t('contracts.monthsPerYear', { count: contract.monthsPerYear }),
			hours: t('contracts.hoursPerDay', {
				hours: formatMinorUnitsAsPlainDecimal(contract.hoursPerDay, MONEY_SCALES.hundredths, formatter.separators.decimal)
			})
		});
	};

	const contractsSummary = (): string => {
		const totalPayslipCount = contracts.reduce((running, contract) => {
			return running + (payslipCounts.get(contract.id) ?? 0);
		}, 0);
		const counted = {
			contracts: t('contracts.count', { count: contracts.length }),
			payslips: t('contracts.payslipCount', { count: totalPayslipCount })
		};

		if(contracts.length === 0) {
			return t('contracts.summaryWithoutPayslips', counted);
		}

		const covered = contracts.flatMap((contract) => {
			return contractYearRange(contract, today);
		});

		return t('contracts.summary', {
			...counted,
			range: t('contracts.range', { from: String(Math.min(...covered)), to: String(Math.max(...covered)) })
		});
	};

	const subtitle = (): string | undefined => {
		if(tab === 'contracts') {
			return contracts.length === 0 ? undefined : contractsSummary();
		}

		return selectedContract ? contractTerms(selectedContract) : undefined;
	};

	const addContractButton = (
		<AppButton
			variant='primary'
			onClick={() => {
				setRefusal(undefined);
				setContractDraft({ contract: undefined });
			}}>
			{t('contracts.add')}
		</AppButton>
	);

	// The list the chooser shows, named out of the translation bundle: a template carries an id and never its own name
	const payslipTemplateChoices = PAYSLIP_TEMPLATES.map((template) => {
		return { id: template.id, name: t(`payslips.import.templates.${template.id}.name`) };
	});

	// What the file itself could not be: the document rather than anything printed on it
	const fileRefusalMessage = (fileRefusal: ImportFileRefusal): string => {
		if(fileRefusal.reason === 'not-a-pdf') {
			return t('import.uploadRefusal.notAPdf');
		}

		return fileRefusal.reason === 'empty' ? t('payslips.import.refusal.noText') : t('import.uploadRefusal.unreadable');
	};

	/**
	 * What the form says about itself: which document it was filled in from, and which figures were not on it.
	 *
	 * **The figures that were not read are named rather than counted**, an empty field on a filled-in form otherwise reading as
	 * a figure the document said was nothing.
	 * @param fileName The document.
	 * @param missing The figures the template did not come back with.
	 * @returns The notice.
	 */
	const importNotice = (fileName: string, missing: readonly PayslipFigure[]): string => {
		if(missing.length === 0) {
			return t('payslips.import.notice', { fileName });
		}

		const named = missing.map((figure) => {
			return t(`payslips.form.${figure}`);
		}).join(', ');

		return t('payslips.import.noticeWithMissing', { fileName, figures: named });
	};

	/**
	 * Opens the ordinary *Add payslip* form on one document, which is what a selection of one does.
	 *
	 * **Nothing is written here.** A document that could not be read says why and leaves the screen as it was; one that could
	 * opens the form filled in as far as the document went, and the payslip exists only once that form is saved.
	 * @param file The document, as the main process read it.
	 * @param template The template it was read under.
	 */
	const openFormOnDocument = (file: ImportFileOutcome, template: PayslipTemplate): void => {
		if(!selectedContract) {
			return;
		}

		if(file.outcome === 'refused') {
			setRefusal(fileRefusalMessage(file.refusal));

			return;
		}

		const applied = applyPayslipTemplate(payslipLinesOf(file.rows, file.positions), template, {
			thirteenth: t('payslips.import.labels.thirteenth')
		});

		if(applied.outcome === 'refused') {
			setRefusal(t(`payslips.import.refusal.${applied.refusal.reason === 'no-text' ? 'noText' : 'periodMissing'}`));

			return;
		}

		// The year picker holds the contract's own years, so a document from another contract's year has nowhere to land
		if(!years.some((row) => {
			return row.year === applied.values.year;
		})) {
			setRefusal(t('payslips.import.refusal.yearOutsideContract', {
				year: String(applied.values.year),
				contract: selectedContract.name
			}));

			return;
		}

		setPayslipDraft({
			payslip: undefined,
			prefill: applied.values,
			notice: importNotice(file.fileName, applied.missing)
		});
	};

	/**
	 * Reads the chosen payslip documents under one template, and opens the one thing their number asks for.
	 *
	 * **One document opens the form and several open the recap** ([§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)).
	 * Neither writes anything: the form is saved by hand as it always was, and the recap writes only the rows that are ticked
	 * when *Save* is pressed on it.
	 * @param id The template the user chose.
	 */
	const readPayslipDocuments = async(id: string): Promise<void> => {
		const template = findPayslipTemplate(id);

		setTemplateDialogOpen(false);

		if(!template || !selectedContract || selectedYear === undefined) {
			return;
		}

		setRefusal(undefined);
		setReading(true);

		try {
			const result = await window.spiccioliImport.readFiles({
				source: template.source,
				scope: 'payslips',
				fileTypeName: t(`import.fileTypes.${template.source.kind}`),
				extensions: extensionsForImportSource(template.source),
				dialogTitle: t('payslips.import.dialogTitle')
			});

			if(result.outcome === 'cancelled') {
				return;
			}

			// The one refusal a whole selection takes, and the one nothing was read for
			if(result.outcome === 'too-many') {
				setRefusal(t('payslips.import.batch.tooMany', { count: result.count, limit: result.limit }));

				return;
			}

			if(result.files.length === 1) {
				openFormOnDocument(result.files[0], template);

				return;
			}

			const rows = buildPayslipBatch({
				files: result.files,
				template,
				labels: { thirteenth: t('payslips.import.labels.thirteenth') },
				contract: selectedContract,
				years: years.map((row) => {
					return row.year;
				}),
				existing: document?.payslips ?? []
			});

			setBatch({ templateId: template.id, rows });
			setTickedRows(defaultPayslipSelection(rows));
		}
		finally {
			setReading(false);
		}
	};

	// A row is ticked or unticked on its own, a duplicate being a flag and not a refusal
	const togglePayslipRow = (key: string): void => {
		setTickedRows((current) => {
			const next = new Set(current);

			if(current.has(key)) {
				next.delete(key);
			}
			else {
				next.add(key);
			}

			return next;
		});
	};

	// The two selectors set the whole selection rather than adding to it, and what they reach is every row that can be written
	const tickEveryPayslipRow = (all: boolean): void => {
		setTickedRows(all && batch ?
			new Set(batch.rows.filter(isWritablePayslipRow).map((row) => {
				return row.key;
			})) :
			new Set());
	};

	/**
	 * Writes the ticked rows of the recap, all of them in one go.
	 *
	 * **The per-year selection follows the last payslip written**, which is the rule a form saved into another year already
	 * follows: a selection spanning two years is left on the later of them, where the last of it landed.
	 */
	const savePayslipBatch = (): void => {
		if(!batch || !selectedContract) {
			return;
		}

		const contractId = selectedContract.id;
		const writing = batch.rows.flatMap((row) => {
			return row.outcome === 'read' && tickedRows.has(row.key) ? [ row.values ] : [];
		});

		if(writing.length === 0) {
			return;
		}

		updateDocument((current) => {
			return {
				...current,
				payslips: [
					...current.payslips,
					...writing.map((values) => {
						return { id: createLedgerId(), contractId, ...values };
					})
				]
			};
		});

		setChosenYear(writing[writing.length - 1].year);
		setBatch(undefined);
	};

	const importPayslipButton = (
		<AppButton
			disabled={reading}
			onClick={() => {
				setRefusal(undefined);
				setTemplateDialogOpen(true);
			}}>
			{reading ? t('payslips.import.reading') : t('payslips.import.action')}
		</AppButton>
	);

	const addPayslipButton = (
		<AppButton
			variant='primary'
			onClick={() => {
				setRefusal(undefined);
				setPayslipDraft({ payslip: undefined });
			}}>
			{t('payslips.add')}
		</AppButton>
	);

	// The selector is what scopes the tab, so it sits beside the heading and never inside one of the tables it scopes
	const contractSelector = (): ReactNode => {
		if(contracts.length < 2 || !selectedContract) {
			return undefined;
		}

		const options: readonly SelectOption<string>[] = contracts.map((contract) => {
			return { value: contract.id, label: contract.name };
		});

		return (
			<SelectField
				value={selectedContract.id}
				options={options}
				label={t('contracts.selector')}
				onChange={(value) => {
					const chosen = contracts.find((contract) => {
						return contract.id === value;
					});

					if(chosen) {
						selectContract(chosen);
					}
				}}/>
		);
	};

	const actions = (): ReactNode => {
		if(tab === 'contracts') {
			return contracts.length === 0 ? undefined : addContractButton;
		}

		if(!selectedContract) {
			return undefined;
		}

		// The button stays in the heading whatever the year holds, so it is where it always is rather than only where the table is full
		return (
			<div className='salaries-screen-actions'>
				{contractSelector()}
				{importPayslipButton}
				{addPayslipButton}
			</div>
		);
	};

	const renderPayslipsTab = (): ReactElement => {
		if(!selectedContract || selectedYear === undefined) {
			return <EmptyState message={t('emptyState.salaries')}>{addContractButton}</EmptyState>;
		}

		return (
			<>
				<SalaryCharts years={years} window={chartWindow} onWindowChange={setChartWindow}/>

				<section className='salaries-screen-card'>
					<h2 className='salaries-screen-card-title'>{t('payslips.yearTable')}</h2>
					<ContractYearsTable
						years={years}
						selectedYear={selectedYear}
						onSelectYear={setChosenYear}
						onEditWorkingDays={setWorkingDaysDraft}/>
				</section>

				<section className='salaries-screen-card'>
					<h2 className='salaries-screen-card-title'>{t('payslips.table', { year: String(selectedYear) })}</h2>
					{payslipsOfYear.length === 0 ?
						<EmptyState
							message={selectedContractPayslipCount === 0 ?
								t('emptyState.payslips') :
								t('emptyState.payslipsOfYear', { year: String(selectedYear) })}>
							{addPayslipButton}
						</EmptyState> :
						<PayslipsTable
							payslips={payslipsOfYear}
							year={selectedYear}
							onEdit={(payslip) => {
								setRefusal(undefined);
								setPayslipDraft({ payslip });
							}}
							onDuplicate={duplicatePayslip}
							onDelete={setPayslipToDelete}/>}
				</section>
			</>
		);
	};

	const renderContractsTab = (): ReactElement => {
		if(contracts.length === 0) {
			return <EmptyState message={t('emptyState.salaries')}>{addContractButton}</EmptyState>;
		}

		return (
			<ContractsTable
				contracts={contracts}
				payslipCounts={payslipCounts}
				selectedId={selectedContract?.id}
				onSelect={selectContract}
				onEdit={(contract) => {
					setRefusal(undefined);
					setContractDraft({ contract });
				}}
				onDelete={requestContractDeletion}/>
		);
	};

	return (
		<ScreenLayout title={t('screens.salaries')} subtitle={subtitle()} actions={actions()}>
			<TabBar
				label={t('screens.salaries')}
				active={tab}
				tabs={[
					{ key: 'payslips', label: t('salaryTabs.payslips') },
					{ key: 'contracts', label: t('salaryTabs.contracts', { count: contracts.length }) }
				]}
				onSelect={(key) => {
					setRefusal(undefined);
					setTab(key as SalariesTab);
				}}/>

			{refusal && (
				<div className='salaries-screen-refusal' role='alert'>
					<p>{refusal}</p>
					<button
						type='button'
						className='salaries-screen-refusal-dismiss'
						onClick={() => {
							setRefusal(undefined);
						}}>
						{t('notice.dismiss')}
					</button>
				</div>
			)}

			{tab === 'payslips' ? renderPayslipsTab() : renderContractsTab()}

			{contractDraft && (
				<ContractForm
					contract={contractDraft.contract}
					onSave={saveContract}
					onCancel={() => {
						setContractDraft(undefined);
					}}/>
			)}

			{templateDialogOpen && (
				<TemplateChooserDialog
					title={t('payslips.import.title')}
					note={t('payslips.import.templateNote')}
					searchPlaceholder={t('payslips.import.templateSearchPlaceholder')}
					entries={payslipTemplateChoices}
					onChoose={(id) => {
						void readPayslipDocuments(id);
					}}
					onCancel={() => {
						setTemplateDialogOpen(false);
					}}/>
			)}

			{batch && selectedContract && (
				<PayslipImportRecap
					contract={selectedContract}
					templateName={t(`payslips.import.templates.${batch.templateId}.name`)}
					rows={batch.rows}
					ticked={tickedRows}
					onToggle={togglePayslipRow}
					onTickAll={tickEveryPayslipRow}
					onSave={savePayslipBatch}
					onCancel={() => {
						setBatch(undefined);
					}}/>
			)}

			{payslipDraft && selectedContract && selectedYear !== undefined && (
				<PayslipForm
					contract={selectedContract}
					years={years.map((row) => {
						return row.year;
					})}
					initialYear={selectedYear}
					payslip={payslipDraft.payslip}
					prefill={payslipDraft.prefill}
					notice={payslipDraft.notice}
					onSave={savePayslip}
					onCancel={() => {
						setPayslipDraft(undefined);
					}}/>
			)}

			{workingDaysDraft && (
				<WorkingDaysForm
					year={workingDaysDraft.year}
					workingDays={workingDaysDraft.workingDays}
					onSave={(workingDays) => {
						writeWorkingDays(workingDaysDraft.year, workingDays);
					}}
					onCancel={() => {
						setWorkingDaysDraft(undefined);
					}}/>
			)}

			{contractToDelete && (
				<ConfirmDialog
					danger
					title={t('contracts.deleteTitle')}
					message={t('contracts.deleteMessage', { name: contractToDelete.name })}
					confirmLabel={t('contracts.deleteConfirm')}
					onConfirm={() => {
						deleteContract(contractToDelete);
					}}
					onCancel={() => {
						setContractToDelete(undefined);
					}}/>
			)}

			{payslipToDelete && (
				<ConfirmDialog
					danger
					title={t('payslips.deleteTitle')}
					message={t('payslips.deleteMessage', {
						month: monthOf(payslipToDelete),
						net: formatter.amount(netSalary(payslipToDelete))
					})}
					confirmLabel={t('payslips.deleteConfirm')}
					onConfirm={() => {
						deletePayslip(payslipToDelete);
					}}
					onCancel={() => {
						setPayslipToDelete(undefined);
					}}/>
			)}
		</ScreenLayout>
	);
};
