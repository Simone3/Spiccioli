import 'src/components/transactions/TransactionsScreen.css';
import { useMemo, useState, type ReactElement } from 'react';
import { AppButton, AppLinkButton } from 'src/components/common/AppButton';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { EmptyState } from 'src/components/common/EmptyState';
import { APP_ROUTES } from 'src/components/shell/AppRoutes';
import { ScreenLayout } from 'src/components/shell/ScreenLayout';
import { useTransactionHandoff } from 'src/components/shell/TransactionHandoff';
import { TransactionFiltersBar } from 'src/components/transactions/TransactionFilters';
import { TransactionForm, type TransactionFormValues } from 'src/components/transactions/TransactionForm';
import { TransactionsPager } from 'src/components/transactions/TransactionsPager';
import { TransactionsTable } from 'src/components/transactions/TransactionsTable';
import { useChecks } from 'src/contexts/ChecksContext';
import { useLedger } from 'src/contexts/LedgerContext';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { indexInstitutions } from 'src/logic/accounts/Accounts';
import { indexCategories } from 'src/logic/categories/Categories';
import { describeMatchedTransactions } from 'src/logic/checks/Matching';
import { categoriseTransaction } from 'src/logic/categories/Categorisation';
import { createLedgerId, nextInsertionSeq } from 'src/logic/ledger/LedgerDocument';
import {
	duplicateTransaction,
	filterTransactions,
	FIRST_TRANSACTION_PAGE,
	isAnyTransactionFilterSet,
	NO_TRANSACTION_FILTERS,
	pageHoldingTransaction,
	sortTransactionsNewestFirst,
	sumTransactionAmounts,
	transactionPage,
	transactionPageCount,
	type TransactionFilters
} from 'src/logic/transactions/Transactions';
import type { Account, LedgerId, Transaction } from 'src/types/LedgerTypes';

/**
 * Transactions: the whole history in one order, seven filters over it, and one form that both records a row and corrects one.
 *
 * **The order is fixed and the list is shown newest first**, so the screen opens on its first page with the most recent rows in
 * view and the pager is how the history is walked back. **Changing a filter lands on the first page of what it now matches** —
 * a page number carried over from another filter would point at a different part of a different list.
 *
 * **The categorisation invariant is restored on every write from here**: a row created, duplicated, switched back to *Automatic*
 * or given a new description carries whatever the rule list produces, and a category set by hand is never touched by any of it.
 *
 * **A selection survives paging and nothing else.** Changing a filter, correcting a row, duplicating, deleting and the bulk
 * delete itself all clear it.
 */

// The record a form is open on. An undefined record is one being created; an undefined draft is a form that is not open.
interface TransactionDraft {
	transaction: Transaction | undefined;
}

// The one bulk action, which confirms once with the count and the total because there is no undo
interface BulkDeletion {
	transactions: readonly Transaction[];
}

/**
 * The Transactions screen.
 * @returns The screen.
 */
export const TransactionsScreen = (): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();
	const { document, updateDocument } = useLedger();

	// The five pairings, derived by the checks run. Named apart from the filtered rows below, which are this screen's own match.
	const { matching: pairings } = useChecks();
	const handoff = useTransactionHandoff();

	// However the screen is reached, it is the same screen: a finished import sets the filters where the user would have set them
	const [ filters, setFilters ] = useState<TransactionFilters>(() => {
		return { ...NO_TRANSACTION_FILTERS, ...handoff };
	});
	const [ selection, setSelection ] = useState<ReadonlySet<LedgerId>>(new Set<LedgerId>());
	const [ rangeAnchorId, setRangeAnchorId ] = useState<LedgerId | undefined>(undefined);
	const [ transactionDraft, setTransactionDraft ] = useState<TransactionDraft | undefined>(undefined);
	const [ transactionToDelete, setTransactionToDelete ] = useState<Transaction | undefined>(undefined);
	const [ bulkDeletion, setBulkDeletion ] = useState<BulkDeletion | undefined>(undefined);

	const transactions = useMemo(() => {
		return document?.transactions ?? [];
	}, [ document ]);

	const rules = useMemo(() => {
		return document?.rules ?? [];
	}, [ document ]);

	const ordered = useMemo(() => {
		return sortTransactionsNewestFirst(transactions);
	}, [ transactions ]);

	const matching = useMemo(() => {
		return filterTransactions(ordered, filters);
	}, [ filters, ordered ]);

	// The first page of what the filters match, which is where the screen opens however it was reached
	const [ requestedPage, setRequestedPage ] = useState(FIRST_TRANSACTION_PAGE);

	const accounts = useMemo((): ReadonlyMap<LedgerId, Account> => {
		return new Map((document?.accounts ?? []).map((account) => {
			return [ account.id, account ];
		}));
	}, [ document ]);

	const institutions = useMemo(() => {
		return indexInstitutions(document?.institutions ?? []);
	}, [ document ]);

	const categories = useMemo(() => {
		return indexCategories(document?.categories ?? []);
	}, [ document ]);

	// What the *Matched* column names, which is derived on the same run that reports what it left over
	const matchedNames = useMemo((): ReadonlyMap<LedgerId, string> => {
		return document && pairings ? describeMatchedTransactions({ document, matching: pairings, translator }) : new Map();
	}, [ document, pairings, translator ]);

	const pageCount = transactionPageCount(matching.length);
	const page = Math.min(requestedPage, pageCount);
	const rows = transactionPage(matching, page);
	const isFiltered = isAnyTransactionFilterSet(filters);
	const selected = transactions.filter((transaction) => {
		return selection.has(transaction.id);
	});

	const clearSelection = (): void => {
		setSelection(new Set<LedgerId>());
		setRangeAnchorId(undefined);
	};

	// Changing a filter recomputes the position rather than keeping it, and every filter change clears the selection
	const changeFilters = (next: TransactionFilters): void => {
		setFilters(next);
		setRequestedPage(FIRST_TRANSACTION_PAGE);
		clearSelection();
	};

	const toggleRow = (id: LedgerId, extend: boolean): void => {
		const next = new Set(selection);
		const anchorPosition = rangeAnchorId === undefined ?
			-1 :
			matching.findIndex((transaction) => {
				return transaction.id === rangeAnchorId;
			});
		const position = matching.findIndex((transaction) => {
			return transaction.id === id;
		});

		if(extend && anchorPosition >= 0 && position >= 0) {
			const start = Math.min(anchorPosition, position);
			const end = Math.max(anchorPosition, position);

			for(const transaction of matching.slice(start, end + 1)) {
				next.add(transaction.id);
			}
		}
		else if(next.has(id)) {
			next.delete(id);
		}
		else {
			next.add(id);
		}

		setSelection(next);
		setRangeAnchorId(id);
	};

	// The header's checkbox reaches everything the filters match and not just the page in view
	const toggleEverything = (): void => {
		if(matching.length > 0 && selected.length === matching.length) {
			clearSelection();

			return;
		}

		setSelection(new Set(matching.map((transaction) => {
			return transaction.id;
		})));
		setRangeAnchorId(undefined);
	};

	// A row the screen has just written is followed to wherever the ordering put it
	const writeAndFollow = (created: Transaction): void => {
		updateDocument((current) => {
			return { ...current, transactions: [ ...current.transactions, created ] };
		});
		setRequestedPage(pageHoldingTransaction(filterTransactions(sortTransactionsNewestFirst([ ...transactions, created ]), filters), created.id));
		clearSelection();
	};

	// Every write from this screen goes through the pass, which is what keeps an automatic row's category the one the rules produce
	const saveTransaction = (values: TransactionFormValues, addAnother: boolean): void => {
		const existing = transactionDraft?.transaction;

		if(existing) {
			updateDocument((current) => {
				return {
					...current,
					transactions: current.transactions.map((candidate) => {
						return candidate.id === existing.id ? categoriseTransaction({ ...candidate, ...values }, current.rules) : candidate;
					})
				};
			});
			clearSelection();
			setTransactionDraft(undefined);

			return;
		}

		writeAndFollow(categoriseTransaction({
			id: createLedgerId(),
			...values,
			insertionSeq: nextInsertionSeq(transactions)
		}, rules));

		if(!addAnother) {
			setTransactionDraft(undefined);
		}
	};

	// The copy is written where the ordering puts it and then opened, a duplicate being for the recurring row that differs in one field
	const duplicate = (transaction: Transaction): void => {
		const copy = duplicateTransaction({ transaction, transactions, rules });

		writeAndFollow(copy);
		setTransactionDraft({ transaction: copy });
	};

	const deleteTransactions = (going: readonly Transaction[]): void => {
		const identities = new Set(going.map((transaction) => {
			return transaction.id;
		}));

		updateDocument((current) => {
			return {
				...current,
				transactions: current.transactions.filter((candidate) => {
					return !identities.has(candidate.id);
				})
			};
		});
		clearSelection();
	};

	const results = t('transactions.resultCount', { count: matching.length });
	const total = formatter.amount(sumTransactionAmounts(matching), true);
	const footer = selected.length > 0 ?
		t('transactions.footerWithSelection', {
			results,
			selected: t('transactions.selectedCount', { count: selected.length }),
			total
		}) :
		t('transactions.footer', { results, total });

	const subtitle = isFiltered ?
		t('transactions.summaryFiltered', { shown: formatter.integer(matching.length), total: formatter.integer(transactions.length) }) :
		t('transactions.count', { count: transactions.length });

	const addButton = (
		<AppButton
			onClick={() => {
				setTransactionDraft({ transaction: undefined });
			}}>
			{t('transactions.add')}
		</AppButton>
	);

	const importButton = <AppLinkButton variant='primary' to={APP_ROUTES.bulkImport}>{t('transactions.bulkImport')}</AppLinkButton>;

	const actions = (
		<>
			{selected.length > 0 && (
				<AppButton
					variant='ghost'
					onClick={() => {
						setBulkDeletion({ transactions: selected });
					}}>
					{t('transactions.bulkDelete', { count: selected.length })}
				</AppButton>
			)}
			{addButton}
			{importButton}
		</>
	);

	return (
		<ScreenLayout
			title={t('screens.transactions')}
			subtitle={transactions.length === 0 ? undefined : subtitle}
			actions={transactions.length === 0 ? undefined : actions}>
			{transactions.length === 0 ?
				<EmptyState message={t('emptyState.transactions')}>
					{addButton}
					<AppLinkButton to={APP_ROUTES.bulkImport}>{t('emptyState.goToImport')}</AppLinkButton>
				</EmptyState> :
				<>
					<TransactionFiltersBar
						filters={filters}
						onChange={changeFilters}
						onClear={() => {
							changeFilters(NO_TRANSACTION_FILTERS);
						}}/>

					{matching.length === 0 ?
						<EmptyState message={t('emptyState.transactionsFiltered')}>
							<AppButton
								onClick={() => {
									changeFilters(NO_TRANSACTION_FILTERS);
								}}>
								{t('filters.clear')}
							</AppButton>
						</EmptyState> :
						<>
							<TransactionsTable
								transactions={rows}
								accounts={accounts}
								institutions={institutions}
								categories={categories}
								matchedNames={matchedNames}
								selection={selection}
								isEverythingSelected={selected.length === matching.length}
								isAnythingSelected={selected.length > 0}
								footer={footer}
								onToggleRow={toggleRow}
								onToggleEverything={toggleEverything}
								onEdit={(transaction) => {
									setTransactionDraft({ transaction });
								}}
								onDuplicate={duplicate}
								onDelete={setTransactionToDelete}/>
							<TransactionsPager page={page} pageCount={pageCount} onChange={setRequestedPage}/>
						</>}
				</>}

			{transactionDraft && (
				<TransactionForm
					transaction={transactionDraft.transaction}
					onSave={saveTransaction}
					onCancel={() => {
						setTransactionDraft(undefined);
					}}/>
			)}

			{transactionToDelete && (
				<ConfirmDialog
					danger
					title={t('transactions.deleteTitle')}
					message={t('transactions.deleteMessage', {
						description: transactionToDelete.description,
						amount: formatter.amount(transactionToDelete.amount, true)
					})}
					confirmLabel={t('transactions.deleteConfirm')}
					onConfirm={() => {
						deleteTransactions([ transactionToDelete ]);
						setTransactionToDelete(undefined);
					}}
					onCancel={() => {
						setTransactionToDelete(undefined);
					}}/>
			)}

			{bulkDeletion && (
				<ConfirmDialog
					danger
					title={t('transactions.bulkDeleteTitle')}
					message={t('transactions.bulkDeleteMessage', {
						count: bulkDeletion.transactions.length,
						total: formatter.amount(sumTransactionAmounts(bulkDeletion.transactions), true)
					})}
					confirmLabel={t('transactions.bulkDeleteConfirm')}
					onConfirm={() => {
						deleteTransactions(bulkDeletion.transactions);
						setBulkDeletion(undefined);
					}}
					onCancel={() => {
						setBulkDeletion(undefined);
					}}/>
			)}
		</ScreenLayout>
	);
};
