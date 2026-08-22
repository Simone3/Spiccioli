import 'src/components/salaries/SalariesScreen.css';
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { AppButton } from 'src/components/common/AppButton';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { EmptyState } from 'src/components/common/EmptyState';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TabBar } from 'src/components/common/TabBar';
import { ContractForm, type ContractFormValues } from 'src/components/salaries/ContractForm';
import { ContractsTable } from 'src/components/salaries/ContractsTable';
import { ContractYearsTable } from 'src/components/salaries/ContractYearsTable';
import { PayslipForm, type PayslipFormValues } from 'src/components/salaries/PayslipForm';
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
import { createLedgerId } from 'src/logic/ledger/LedgerDocument';
import { formatMinorUnitsAsPlainDecimal, MONEY_SCALES } from 'src/logic/money/Money';
import { countPayslipsPerContract, contractYearRange, sortContracts } from 'src/logic/salaries/Contracts';
import { netSalary, payslipsOfContract, sortPayslipsOfYear } from 'src/logic/salaries/Payslips';
import { deriveSalaryYears, type SalaryYearFigures } from 'src/logic/salaries/SalaryFigures';
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
 */

type SalariesTab = 'payslips' | 'contracts';

// The record a form is open on. An undefined record is one being created; an undefined draft is a form that is not open.
interface ContractDraft {
	contract: Contract | undefined;
}

interface PayslipDraft {
	payslip: Payslip | undefined;
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
	const [ contractDraft, setContractDraft ] = useState<ContractDraft | undefined>(undefined);
	const [ payslipDraft, setPayslipDraft ] = useState<PayslipDraft | undefined>(undefined);
	const [ contractToDelete, setContractToDelete ] = useState<Contract | undefined>(undefined);
	const [ payslipToDelete, setPayslipToDelete ] = useState<Payslip | undefined>(undefined);
	const [ workingDaysDraft, setWorkingDaysDraft ] = useState<SalaryYearFigures | undefined>(undefined);
	const [ refusal, setRefusal ] = useState<string | undefined>(undefined);

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
				<SalaryCharts years={years}/>

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

			{payslipDraft && selectedContract && selectedYear !== undefined && (
				<PayslipForm
					contract={selectedContract}
					years={years.map((row) => {
						return row.year;
					})}
					initialYear={selectedYear}
					payslip={payslipDraft.payslip}
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
