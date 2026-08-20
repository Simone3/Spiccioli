import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, stubLedgerBridge } from '../testUtils';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { DataTable } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { RowMenu } from 'src/components/common/RowMenu';

describe('the row menu', () => {
	test('opens on a real button and closes on Escape', async() => {
		stubLedgerBridge();
		renderWithProviders(
			<RowMenu
				label='Actions for Conto Corrente'
				actions={[ { key: 'delete', label: 'Delete', danger: true, onSelect: () => {} } ]}/>
		);

		const trigger = screen.getByRole('button', { name: 'Actions for Conto Corrente' });

		await userEvent.click(trigger);

		expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();

		await userEvent.keyboard('{Escape}');

		expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	test('is drawn at the top of the document, where a scrolling table cannot clip it, with the keyboard on its first entry', async() => {
		stubLedgerBridge();
		renderWithProviders(
			<div style={{ overflow: 'auto' }}>
				<RowMenu
					label='Actions for Conto Corrente'
					actions={[ { key: 'edit', label: 'Edit', onSelect: () => {} } ]}/>
			</div>
		);

		await userEvent.click(screen.getByRole('button', { name: 'Actions for Conto Corrente' }));

		expect(screen.getByRole('menu', { name: 'Actions for Conto Corrente' }).parentElement).toBe(document.body);
		expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
	});
});

describe('the confirmation', () => {
	test('is what a delete asks for, and Escape is what cancels it', async() => {
		stubLedgerBridge();

		let cancelled = false;
		renderWithProviders(
			<ConfirmDialog
				title='Delete this account?'
				message='Nothing points at it.'
				confirmLabel='Delete'
				danger
				onConfirm={() => {}}
				onCancel={() => {
					cancelled = true;
				}}/>
		);

		expect(screen.getByRole('dialog', { name: 'Delete this account?' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

		await userEvent.keyboard('{Escape}');

		expect(cancelled).toBe(true);
	});
});

describe('the table', () => {
	test('renders a zero like any other figure, since a zero is not an empty state', () => {
		stubLedgerBridge();
		renderWithProviders(
			<DataTable
				label='Accounts'
				columns={[ {
					key: 'balance',
					header: 'Balance',
					numeric: true,
					render: (row: { balance: string }) => {
						return row.balance;
					}
				} ]}
				rows={[ { balance: '€ 0,00' } ]}
				getRowKey={() => {
					return 'only';
				}}
				footer='1 account'/>
		);

		expect(screen.getByRole('cell', { name: '€ 0,00' })).toBeInTheDocument();
		expect(screen.getByText('1 account')).toBeInTheDocument();
	});

	test('ends on a totals row that states every total in the column it totals, the rest spanned by one label', () => {
		stubLedgerBridge();
		renderWithProviders(
			<DataTable
				label='Accounts'
				columns={[
					{
						key: 'name',
						header: 'Name',
						render: (row: { name: string; balance: string }) => {
							return row.name;
						}
					},
					{
						key: 'balance',
						header: 'Balance',
						numeric: true,
						total: '€ 30,00',
						render: (row: { name: string; balance: string }) => {
							return row.balance;
						}
					}
				]}
				rows={[ { name: 'Conto Corrente', balance: '€ 30,00' } ]}
				getRowKey={(row) => {
					return row.name;
				}}
				totalLabel='Total'/>
		);

		const totals = screen.getByRole('row', { name: 'Total € 30,00' });

		// The one column with nothing to total is spanned by the label, and the total sits under the figure it is the sum of
		expect(within(totals).getByRole('cell', { name: 'Total' })).toHaveAttribute('colspan', '1');
		expect(within(totals).getByRole('cell', { name: '€ 30,00' })).toBeInTheDocument();
	});
});

describe('the empty state', () => {
	test('names the action that fills the screen', () => {
		stubLedgerBridge();
		renderWithProviders(<EmptyState message='Nothing here yet.'><button type='button'>Add one</button></EmptyState>);

		expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument();
	});
});
