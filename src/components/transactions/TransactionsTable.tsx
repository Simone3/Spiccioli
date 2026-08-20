import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import type { Account, Category, Institution, LedgerId, Transaction } from 'src/types/LedgerTypes';

/**
 * The transactions themselves: one page of them, read as they stand and corrected in the form the row menu opens.
 *
 * **The category chip states provenance rather than correctness**: violet where a rule assigned it, neutral where the user did,
 * red where no rule matched — which is what check 2 counts. **Notes are the user's**, and the application never writes to them.
 *
 * ***Matched* is derived**, and it names the counterpart of every kind of pairing there is: the counterpart account for a paired
 * internal transfer, the security for a trade-matched securities transaction, and the payslip — its month and its label — for a
 * salary payment or a pension credit. An em dash otherwise.
 */

export interface TransactionsTableProps {

	// One page of what the filters match, already ordered
	transactions: readonly Transaction[];

	accounts: ReadonlyMap<LedgerId, Account>;
	institutions: ReadonlyMap<LedgerId, Institution>;
	categories: ReadonlyMap<LedgerId, Category>;

	// What each paired row's counterpart is called, as the matching derived it. A row with no entry is one nothing paired with.
	matchedNames: ReadonlyMap<LedgerId, string>;

	// Every row ticked, across the pages: a selection may span them
	selection: ReadonlySet<LedgerId>;

	// Whether everything the filters match is ticked, and whether anything at all is
	isEverythingSelected: boolean;
	isAnythingSelected: boolean;

	footer: ReactNode;

	// Called with whether the click extended a range, which is what a shift-click does
	onToggleRow: (id: LedgerId, extend: boolean) => void;

	onToggleEverything: () => void;

	onEdit: (transaction: Transaction) => void;
	onDuplicate: (transaction: Transaction) => void;
	onDelete: (transaction: Transaction) => void;
}

/**
 * The transactions table.
 * @param props The table's props.
 * @param props.transactions The page's rows.
 * @param props.accounts The accounts, by id.
 * @param props.institutions The institutions, by id.
 * @param props.categories The categories, by id.
 * @param props.matchedNames What each paired row's counterpart is called.
 * @param props.selection What is ticked.
 * @param props.isEverythingSelected Whether everything the filters match is ticked.
 * @param props.isAnythingSelected Whether anything is ticked.
 * @param props.footer What goes under the rule.
 * @param props.onToggleRow What ticking a row does.
 * @param props.onToggleEverything What the header's checkbox does.
 * @param props.onEdit What correcting a row does.
 * @param props.onDuplicate What duplicating a row does.
 * @param props.onDelete What deleting a row does.
 * @returns The table.
 */
export const TransactionsTable = ({
	transactions,
	accounts,
	institutions,
	categories,
	matchedNames,
	selection,
	isEverythingSelected,
	isAnythingSelected,
	footer,
	onToggleRow,
	onToggleEverything,
	onEdit,
	onDuplicate,
	onDelete
}: TransactionsTableProps): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const formatter = useFormatter();

	const accountNameOf = (transaction: Transaction): string => {
		const account = accounts.get(transaction.accountId);

		return account ? formatAccountName(account, institutions, translator) : '';
	};

	const categoryChipOf = (transaction: Transaction): ReactNode => {
		const category = transaction.categoryId === null ? undefined : categories.get(transaction.categoryId);

		if(!category) {
			return <Chip tone='danger'>{t('transactions.noCategory')}</Chip>;
		}

		return <Chip tone={transaction.categorySource === 'automatic' ? 'provenance' : 'neutral'}>{category.name}</Chip>;
	};

	const columns: readonly DataTableColumn<Transaction>[] = [
		{
			key: 'selection',
			header: (
				<input
					type='checkbox'
					className='data-table-checkbox'
					checked={isEverythingSelected}
					aria-label={t('transactions.selectAll')}
					ref={(node) => {
						if(node) {
							node.indeterminate = isAnythingSelected && !isEverythingSelected;
						}
					}}
					onChange={onToggleEverything}/>
			),
			render: (transaction) => {
				return (
					<input
						type='checkbox'
						className='data-table-checkbox'
						checked={selection.has(transaction.id)}
						aria-label={t('transactions.select', { description: transaction.description })}
						onChange={(event) => {
							onToggleRow(transaction.id, (event.nativeEvent as MouseEvent).shiftKey);
						}}/>
				);
			}
		},
		{
			key: 'date',
			header: t('transactions.columns.date'),
			numeric: true,
			render: (transaction) => {
				return formatter.storedDate(transaction.date);
			}
		},
		{
			key: 'account',
			header: t('transactions.columns.account'),
			render: (transaction) => {
				return <span className='transactions-screen-account'>{accountNameOf(transaction)}</span>;
			}
		},
		{
			key: 'description',
			header: t('transactions.columns.description'),
			render: (transaction) => {
				return transaction.description;
			}
		},
		{
			key: 'amount',
			header: t('transactions.columns.amount'),
			numeric: true,
			render: (transaction) => {
				return (
					<span className={transaction.amount < 0 ? 'transactions-screen-negative' : 'transactions-screen-positive'}>
						{formatter.amount(transaction.amount, true)}
					</span>
				);
			}
		},
		{
			key: 'category',
			header: t('transactions.columns.category'),
			render: categoryChipOf
		},
		{
			key: 'matched',
			header: t('transactions.columns.matched'),
			render: (transaction) => {
				const name = matchedNames.get(transaction.id);

				if(name === undefined) {
					return (
						<span className='transactions-screen-unmatched' aria-label={t('transactions.matched.noneLabel')}>
							{t('transactions.matched.none')}
						</span>
					);
				}

				return <span className='transactions-screen-matched'>{t('transactions.matched.counterpart', { name })}</span>;
			}
		},
		{
			key: 'receipt',
			header: t('transactions.columns.receipt'),
			render: (transaction) => {
				return (
					<span className={`transactions-screen-receipt transactions-screen-receipt-${transaction.receiptState}`}>
						{t(`receiptStates.${transaction.receiptState}`)}
					</span>
				);
			}
		},
		{
			key: 'notes',
			header: t('transactions.columns.notes'),
			render: (transaction) => {
				return <span className='transactions-screen-notes'>{transaction.notes || t('transactions.noNotes')}</span>;
			}
		},
		{
			key: 'actions',
			header: '',
			render: (transaction) => {
				return (
					<RowMenu
						label={t('transactions.rowMenu', { description: transaction.description })}
						actions={[
							{
								key: 'edit',
								label: t('rowMenu.edit'),
								onSelect: () => {
									onEdit(transaction);
								}
							},
							{
								key: 'duplicate',
								label: t('rowMenu.duplicate'),
								onSelect: () => {
									onDuplicate(transaction);
								}
							},
							{
								key: 'delete',
								label: t('rowMenu.delete'),
								danger: true,
								onSelect: () => {
									onDelete(transaction);
								}
							}
						]}/>
				);
			}
		}
	];

	return (
		<DataTable
			columns={columns}
			rows={transactions}
			label={t('transactions.table')}
			footer={footer}
			getRowKey={(transaction) => {
				return transaction.id;
			}}
			getRowClassName={(transaction) => {
				return selection.has(transaction.id) ? 'transactions-screen-row-selected' : undefined;
			}}/>
	);
};
