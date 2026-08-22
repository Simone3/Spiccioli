import 'src/components/categories/CategoriesScreen.css';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { ApplyChangesDialog } from 'src/components/categories/ApplyChangesDialog';
import { CategoryListTable } from 'src/components/categories/CategoryListTable';
import { CategoryReportTable } from 'src/components/categories/CategoryReportTable';
import { RuleForm } from 'src/components/categories/RuleForm';
import { RulesTable, type RuleDraftMarker } from 'src/components/categories/RulesTable';
import { AppButton, type AppButtonVariant } from 'src/components/common/AppButton';
import { EmptyState } from 'src/components/common/EmptyState';
import { FilterBar, FilterBarFilter } from 'src/components/common/FilterBar';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TabBar } from 'src/components/common/TabBar';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useHandOverToTransactions } from 'src/components/shell/ScreenHandoff';
import { useLedger } from 'src/contexts/LedgerContext';
import { useRemembered } from 'src/contexts/ScreenMemoryContext';
import { useUnsavedDraft, useUnsavedDraftGuard } from 'src/contexts/UnsavedDraftContext';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { useTranslator } from 'src/i18n/TranslationContext';
import { countTransactionsPerCategory, sortCategories } from 'src/logic/categories/Categories';
import { countRuleApplications, recategoriseTransactions, summariseRecategorisation } from 'src/logic/categories/Categorisation';
import {
	buildCategoryReport,
	CATEGORY_REPORT_YEARS,
	type CategoryReportFilters,
	type CategoryReportYears
} from 'src/logic/categories/CategoryReport';
import {
	addRuleToDraft,
	countPendingRuleChanges,
	createRuleDraft,
	moveRuleInDraft,
	removeRuleFromDraft,
	updateRuleInDraft,
	type RuleValues
} from 'src/logic/categories/RuleDraft';
import type { Category, LedgerId, Rule, Transaction } from 'src/types/LedgerTypes';

/**
 * Categories: the report, the rules that fill it, and the list both are made of.
 *
 * **The report is the one table that reads in the stored `order`**; the list and every picker are alphabetical.
 *
 * **The rules are edited as a session and applied once.** Adding, correcting, deleting and reordering all accumulate in a draft
 * that writes nothing, and *Apply changes* is the single moment at which the rules and every category they move are written
 * together. Leaving the tab, the screen, the file or the application with one pending goes through the unsaved-draft prompt,
 * which offers discard and stay and nothing else — **applying is a decision taken against the consequence summary** and not
 * against a dialog raised by walking away.
 */

type CategoriesScreenTab = 'report' | 'rules' | 'list';

// The record the rule form is open on. An undefined rule is one being added; an undefined draft is a form that is not open.
interface RuleFormDraft {
	rule: Rule | undefined;
}

// Stable empty lists, so that a document that is not open yet does not hand back a different array on every render
const NO_RULES: readonly Rule[] = [];

const NO_TRANSACTIONS: readonly Transaction[] = [];

const NO_CATEGORIES: readonly Category[] = [];

/**
 * The Categories screen.
 * @returns The screen.
 */
export const CategoriesScreen = (): ReactElement => {
	const { t } = useTranslator();
	const { document, updateDocument } = useLedger();
	const { requestDeparture } = useUnsavedDraftGuard();
	const handOverToTransactions = useHandOverToTransactions();

	// The tab and the report's two filters are what the screen is found showing when it is come back to ([§12.2]). The rule
	// draft below is not: leaving the screen with one pending is what the unsaved-draft prompt asks about, and its answer is discard
	const [ tab, setTab ] = useRemembered<CategoriesScreenTab>('categories', 'tab', 'report');
	const [ reportFilters, setReportFilters ] = useRemembered<CategoryReportFilters>('categories', 'reportFilters', {
		years: 'last-5',
		accountId: undefined
	});
	const [ ruleFormDraft, setRuleFormDraft ] = useState<RuleFormDraft | undefined>(undefined);
	const [ isApplying, setIsApplying ] = useState(false);

	const transactions = document?.transactions ?? NO_TRANSACTIONS;
	const categories = document?.categories ?? NO_CATEGORIES;
	const applied = document?.rules ?? NO_RULES;

	const [ draft, setDraft ] = useState<readonly Rule[]>(() => {
		return createRuleDraft(applied);
	});

	// The rules array changes identity only when the rules themselves are written, so this reseeds the draft after an apply and
	// after a different file is opened, and never after an unrelated edit
	const appliedRef = useRef(applied);

	useEffect(() => {
		if(appliedRef.current !== applied) {
			appliedRef.current = applied;
			setDraft(createRuleDraft(applied));
		}
	}, [ applied ]);

	// Today is read once: a report that redrew its own columns halfway through a session would be a stranger thing than one that
	// is a day behind at midnight
	const today = useMemo(() => {
		return DateUtils.toStandardYearMonthDay(new Date());
	}, []);

	const pendingChanges = countPendingRuleChanges(applied, draft);
	const isDraftPending = pendingChanges > 0;

	const discardDraft = (): void => {
		setDraft(createRuleDraft(applied));
		setRuleFormDraft(undefined);
		setIsApplying(false);
	};

	useUnsavedDraft(isDraftPending, discardDraft);

	const alphabetical = useMemo(() => {
		return sortCategories(categories);
	}, [ categories ]);

	const categoryCounts = useMemo(() => {
		return countTransactionsPerCategory(transactions);
	}, [ transactions ]);

	const categoryNames = useMemo((): ReadonlyMap<LedgerId, string> => {
		return new Map(categories.map((category) => {
			return [ category.id, category.name ];
		}));
	}, [ categories ]);

	// The counts describe the applied list, not the draft: they say what each rule accounts for in the file as it stands
	const applications = useMemo(() => {
		return countRuleApplications(applied, transactions);
	}, [ applied, transactions ]);

	const markers = useMemo((): ReadonlyMap<LedgerId, RuleDraftMarker> => {
		const before = new Map(applied.map((rule) => {
			return [ rule.id, rule ];
		}));

		return new Map(draft.flatMap((rule): [ LedgerId, RuleDraftMarker ][] => {
			const existing = before.get(rule.id);

			if(!existing) {
				return [ [ rule.id, 'added' ] ];
			}

			return existing.substring === rule.substring && existing.categoryId === rule.categoryId ? [] : [ [ rule.id, 'edited' ] ];
		}));
	}, [ applied, draft ]);

	const report = useMemo(() => {
		return buildCategoryReport({ transactions, categories, filters: reportFilters, today });
	}, [ categories, reportFilters, today, transactions ]);

	const summary = useMemo(() => {
		return summariseRecategorisation(transactions, draft);
	}, [ draft, transactions ]);

	// Confirming writes the rules and every category they move in one step, which is the whole of what applying does
	const applyDraft = (): void => {
		updateDocument((current) => {
			return {
				...current,
				transactions: recategoriseTransactions(current.transactions, draft),
				rules: [ ...draft ]
			};
		});
		setIsApplying(false);
	};

	// A report figure hands its filters to Transactions: the category, the account as the report has it, and the period the
	// figure was made of — one year for a cell, the whole of what the table is showing for a row total
	const openTransactions = (category: Category, year: number | undefined): void => {
		const from = year ?? report.years[0];
		const to = year ?? report.years[report.years.length - 1];

		// A figure leads off this screen like a sidebar entry does, so a draft on the other tab is asked about first
		requestDeparture(() => {
			handOverToTransactions({
				category: category.id,
				accountId: reportFilters.accountId,
				fromDate: `${from}-01-01`,
				toDate: `${to}-12-31`
			});
		});
	};

	const yearOptions: readonly SelectOption<CategoryReportYears>[] = CATEGORY_REPORT_YEARS.map((years) => {
		return { value: years, label: t(`report.years.${years}`) };
	});

	// Primary where it is the only thing to do and secondary beside *Apply changes*, which is the primary action once there is a draft
	const addRuleButton = (variant: AppButtonVariant): ReactElement => {
		return (
			<AppButton
				variant={variant}
				onClick={() => {
					setRuleFormDraft({ rule: undefined });
				}}>
				{t('rules.add')}
			</AppButton>
		);
	};

	const subtitleOfTab = (): string => {
		if(tab === 'list') {
			return t('categoryList.summary', { count: categories.length });
		}

		if(tab === 'rules') {
			const rules = t('rules.count', { count: draft.length });

			return isDraftPending ? t('rules.summaryPending', { rules, pending: t('rules.pendingCount', { count: pendingChanges }) }) : rules;
		}

		if(report.years.length === 0) {
			return t('report.noYears');
		}

		return t('report.range', {
			from: String(report.years[0]),
			to: String(report.years[report.years.length - 1])
		});
	};

	const actionsOfTab = (): ReactElement | undefined => {
		if(tab !== 'rules') {
			return undefined;
		}

		// Both are always offered and both are enabled only while there is something to apply or to throw away
		return (
			<>
				<AppButton variant='ghost' disabled={!isDraftPending} onClick={discardDraft}>{t('rules.discard')}</AppButton>
				<AppButton
					variant='primary'
					disabled={!isDraftPending}
					onClick={() => {
						setIsApplying(true);
					}}>
					{t('rules.apply.action')}
				</AppButton>
				{draft.length > 0 && addRuleButton('secondary')}
			</>
		);
	};

	// The counts are about the file, so the footer says so exactly where they stop describing what is on screen
	const rulesFooter = isDraftPending ?
		t('rules.footerPending', { rules: t('rules.summary', { count: draft.length }), applied: t('rules.footerApplied') }) :
		t('rules.summary', { count: draft.length });

	return (
		<ScreenLayout title={t('screens.categories')} subtitle={subtitleOfTab()} actions={actionsOfTab()}>
			<TabBar
				label={t('screens.categories')}
				active={tab}
				tabs={[
					{ key: 'report', label: t('categoryTabs.report') },
					{ key: 'rules', label: t('categoryTabs.rules') },
					{ key: 'list', label: t('categoryTabs.list') }
				]}
				onSelect={(key) => {
					requestDeparture(() => {
						setTab(key as CategoriesScreenTab);
					});
				}}/>

			{tab === 'report' && (report.years.length === 0 ?
				<EmptyState message={t('emptyState.report')}>
					<AppButton
						onClick={() => {
							requestDeparture(() => {
								handOverToTransactions({});
							});
						}}>
						{t('emptyState.goToTransactions')}
					</AppButton>
				</EmptyState> :
				<>
					<FilterBar
						isFiltered={reportFilters.accountId !== undefined}
						onClear={() => {
							setReportFilters({ ...reportFilters, accountId: undefined });
						}}>
						<FilterBarFilter label={t('report.filters.years')}>
							<SelectField
								value={reportFilters.years}
								options={yearOptions}
								label={t('report.filters.years')}
								onChange={(years) => {
									setReportFilters({ ...reportFilters, years });
								}}/>
						</FilterBarFilter>

						<FilterBarFilter label={t('report.filters.account')}>
							<AccountPicker
								value={reportFilters.accountId}
								clearable
								side='cash'
								label={t('report.filters.account')}
								placeholder={t('report.filters.accountAll')}
								onChange={(accountId) => {
									setReportFilters({ ...reportFilters, accountId });
								}}/>
						</FilterBarFilter>
					</FilterBar>

					<CategoryReportTable report={report} today={today} onOpen={openTransactions}/>
				</>)}

			{tab === 'rules' && (draft.length === 0 ?
				<EmptyState message={t('emptyState.categories')}>{addRuleButton('primary')}</EmptyState> :
				<RulesTable
					rules={draft}
					categoryNames={categoryNames}
					applications={applications}
					markers={markers}
					isDraftPending={isDraftPending}
					footer={rulesFooter}
					onMove={(fromIndex, toIndex) => {
						setDraft(moveRuleInDraft(draft, fromIndex, toIndex));
					}}
					onEdit={(rule) => {
						setRuleFormDraft({ rule });
					}}
					onDelete={(rule) => {
						setDraft(removeRuleFromDraft(draft, rule.id));
					}}/>)}

			{tab === 'list' && (
				<CategoryListTable
					categories={alphabetical}
					counts={categoryCounts}
					footer={t('categoryList.footer', {
						categories: t('categoryList.summary', { count: categories.length }),
						transactions: t('transactions.count', { count: transactions.filter((transaction) => {
							return transaction.categoryId !== null;
						}).length })
					})}/>
			)}

			{ruleFormDraft && (
				<RuleForm
					rule={ruleFormDraft.rule}
					onSave={(values: RuleValues) => {
						const existing = ruleFormDraft.rule;

						setDraft(existing ? updateRuleInDraft(draft, existing.id, values) : addRuleToDraft(draft, values));
						setRuleFormDraft(undefined);
					}}
					onCancel={() => {
						setRuleFormDraft(undefined);
					}}/>
			)}

			{isApplying && (
				<ApplyChangesDialog
					summary={summary}
					pendingChanges={pendingChanges}
					onConfirm={applyDraft}
					onCancel={() => {
						setIsApplying(false);
					}}/>
			)}
		</ScreenLayout>
	);
};
