import type { ReactElement, ReactNode } from 'react';
import { AccountPicker } from 'src/components/accounts/AccountPicker';
import { AUTOMATIC_CATEGORY, CategoryPicker } from 'src/components/categories/CategoryPicker';
import { Chip } from 'src/components/common/Chip';
import { DataTable, type DataTableColumn } from 'src/components/common/DataTable';
import { DateField } from 'src/components/common/DateField';
import { EditableCell } from 'src/components/common/EditableCell';
import { AmountField } from 'src/components/common/NumericFields';
import { RowMenu } from 'src/components/common/RowMenu';
import { SelectField, type SelectOption } from 'src/components/common/SelectField';
import { TextField } from 'src/components/common/TextField';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import { formatAccountName } from 'src/logic/accounts/Accounts';
import { RECEIPT_STATES, type Account, type Category, type Cents, type Institution, type IsoDate, type LedgerId, type ReceiptState, type Transaction } from 'src/types/LedgerTypes';

/**
 * The transactions themselves: one page of them, every cell edited where it sits.
 *
 * **The category chip states provenance rather than correctness**: violet where a rule assigned it, neutral where the user did,
 * red where no rule matched — which is what check 2 counts. **Notes are the user's**, and the application never writes to them.
 *
 * *Matched* is not a column yet: it is derived from the pairings, and it arrives with the checks.
 */

export interface TransactionsTableProps {

	// One page of what the filters match, already ordered
	transactions: readonly Transaction[];

	accounts: ReadonlyMap<LedgerId, Account>;
	institutions: ReadonlyMap<LedgerId, Institution>;
	categories: ReadonlyMap<LedgerId, Category>;

	// Every row ticked, across the pages: a selection may span them
	selection: ReadonlySet<LedgerId>;

	// Whether everything the filters match is ticked, and whether anything at all is
	isEverythingSelected: boolean;
	isAnythingSelected: boolean;

	footer: ReactNode;

	// Called with whether the click extended a range, which is what a shift-click does
	onToggleRow: (id: LedgerId, extend: boolean) => void;

	onToggleEverything: () => void;

	// Called with what a committed cell changed. The invariant on an automatic row's category is restored above this.
	onEdit: (transaction: Transaction, changes: Partial<Transaction>) => void;

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
 * @param props.selection What is ticked.
 * @param props.isEverythingSelected Whether everything the filters match is ticked.
 * @param props.isAnythingSelected Whether anything is ticked.
 * @param props.footer What goes under the rule.
 * @param props.onToggleRow What ticking a row does.
 * @param props.onToggleEverything What the header's checkbox does.
 * @param props.onEdit What a committed cell does.
 * @param props.onDuplicate What duplicating a row does.
 * @param props.onDelete What deleting a row does.
 * @returns The table.
 */
export const TransactionsTable = ({
	transactions,
	accounts,
	institutions,
	categories,
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

	const receiptOptions: readonly SelectOption<ReceiptState>[] = RECEIPT_STATES.map((state) => {
		return { value: state, label: t(`receiptStates.${state}`) };
	});

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
					className='transactions-screen-checkbox'
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
						className='transactions-screen-checkbox'
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
				return (
					<EditableCell<IsoDate | undefined>
						value={transaction.date}
						label={t('transactions.edit.date', { description: transaction.description })}
						renderEditor={(value, onChange) => {
							return <DateField value={value} label={t('transactions.columns.date')} required onChange={onChange}/>;
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(transaction, { date: value });

							return undefined;
						}}>
						{formatter.storedDate(transaction.date)}
					</EditableCell>
				);
			}
		},
		{
			key: 'account',
			header: t('transactions.columns.account'),
			render: (transaction) => {
				return (
					<EditableCell<LedgerId | undefined>
						value={transaction.accountId}
						label={t('transactions.edit.account', { description: transaction.description })}
						renderEditor={(value, onChange) => {
							return (
								<AccountPicker
									value={value}
									side='cash'
									label={t('transactions.columns.account')}
									placeholder={t('transactions.form.accountChoose')}
									onChange={onChange}/>
							);
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(transaction, { accountId: value });

							return undefined;
						}}>
						<span className='transactions-screen-account'>{accountNameOf(transaction)}</span>
					</EditableCell>
				);
			}
		},
		{
			key: 'description',
			header: t('transactions.columns.description'),
			render: (transaction) => {
				return (
					<EditableCell<string>
						value={transaction.description}
						label={t('transactions.edit.description', { description: transaction.description })}
						renderEditor={(value, onChange) => {
							return <TextField value={value} label={t('transactions.columns.description')} onChange={onChange}/>;
						}}
						onCommit={(value) => {
							if(value.trim() === '') {
								return t('field.required');
							}

							onEdit(transaction, { description: value.trim() });

							return undefined;
						}}>
						{transaction.description}
					</EditableCell>
				);
			}
		},
		{
			key: 'amount',
			header: t('transactions.columns.amount'),
			numeric: true,
			render: (transaction) => {
				return (
					<EditableCell<Cents | undefined>
						value={transaction.amount}
						label={t('transactions.edit.amount', { description: transaction.description })}
						renderEditor={(value, onChange) => {
							return <AmountField value={value} label={t('transactions.columns.amount')} allowNegative required onChange={onChange}/>;
						}}
						onCommit={(value) => {
							if(value === undefined) {
								return t('field.required');
							}

							onEdit(transaction, { amount: value });

							return undefined;
						}}>
						<span className={transaction.amount < 0 ? 'transactions-screen-negative' : 'transactions-screen-positive'}>
							{formatter.amount(transaction.amount, true)}
						</span>
					</EditableCell>
				);
			}
		},
		{
			key: 'category',
			header: t('transactions.columns.category'),
			render: (transaction) => {
				return (
					<EditableCell<string>
						value={transaction.categorySource === 'automatic' ? AUTOMATIC_CATEGORY : transaction.categoryId ?? AUTOMATIC_CATEGORY}
						label={t('transactions.edit.category', { description: transaction.description })}
						renderEditor={(value, onChange) => {
							return <CategoryPicker value={value} mode='assign' label={t('transactions.columns.category')} onChange={onChange}/>;
						}}
						onCommit={(value) => {
							onEdit(transaction, value === AUTOMATIC_CATEGORY ?
								{ categorySource: 'automatic' } :
								{ categoryId: value, categorySource: 'manual' });

							return undefined;
						}}>
						{categoryChipOf(transaction)}
					</EditableCell>
				);
			}
		},
		{
			key: 'receipt',
			header: t('transactions.columns.receipt'),
			render: (transaction) => {
				return (
					<EditableCell<ReceiptState>
						value={transaction.receiptState}
						label={t('transactions.edit.receipt', { description: transaction.description })}
						renderEditor={(value, onChange) => {
							return <SelectField value={value} options={receiptOptions} label={t('transactions.columns.receipt')} onChange={onChange}/>;
						}}
						onCommit={(value) => {
							onEdit(transaction, { receiptState: value });

							return undefined;
						}}>
						<span className={`transactions-screen-receipt transactions-screen-receipt-${transaction.receiptState}`}>
							{t(`receiptStates.${transaction.receiptState}`)}
						</span>
					</EditableCell>
				);
			}
		},
		{
			key: 'notes',
			header: t('transactions.columns.notes'),
			render: (transaction) => {
				return (
					<EditableCell<string>
						value={transaction.notes}
						label={t('transactions.edit.notes', { description: transaction.description })}
						renderEditor={(value, onChange) => {
							return <TextField value={value} label={t('transactions.columns.notes')} placeholder={t('form.optional')} onChange={onChange}/>;
						}}
						onCommit={(value) => {
							onEdit(transaction, { notes: value.trim() });

							return undefined;
						}}>
						<span className='transactions-screen-notes'>{transaction.notes || t('transactions.noNotes')}</span>
					</EditableCell>
				);
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
