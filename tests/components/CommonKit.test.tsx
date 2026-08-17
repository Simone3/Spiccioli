import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { renderWithProviders, stubLedgerBridge } from '../testUtils';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { DataTable } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { InlineEditCell } from 'src/components/common/InlineEditCell';
import { RowMenu } from 'src/components/common/RowMenu';

const REFUSAL = 'That name is already taken.';

const InlineEditHarness = ({ refuses }: { refuses: boolean }): ReactElement => {
	const [ value, setValue ] = useState('Conto Corrente');
	const [ draft, setDraft ] = useState(value);

	return (
		<InlineEditCell
			label='Edit name'
			renderEditor={() => {
				return (
					<input
						aria-label='Name'
						value={draft}
						onChange={(event) => {
							setDraft(event.target.value);
						}}/>
				);
			}}
			onCommit={() => {
				if(refuses) {
					return REFUSAL;
				}

				setValue(draft);

				return undefined;
			}}
			onCancel={() => {
				setDraft(value);
			}}>
			{value}
		</InlineEditCell>
	);
};

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

describe('the inline edit', () => {
	test('keeps the cell open with the reason when the value is refused, and never half-changes the row', async() => {
		stubLedgerBridge();
		renderWithProviders(<InlineEditHarness refuses/>);

		await userEvent.click(screen.getByRole('button', { name: 'Edit name' }));
		await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Conto Titoli');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.getByRole('alert')).toHaveTextContent(REFUSAL);
		expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
	});

	test('puts back the previous value when the edit is abandoned', async() => {
		stubLedgerBridge();
		renderWithProviders(<InlineEditHarness refuses={false}/>);

		await userEvent.click(screen.getByRole('button', { name: 'Edit name' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' 2');
		await userEvent.keyboard('{Escape}');

		expect(screen.getByRole('button', { name: 'Edit name' })).toHaveTextContent('Conto Corrente');
	});

	test('takes a value the caller accepts and closes', async() => {
		stubLedgerBridge();
		renderWithProviders(<InlineEditHarness refuses={false}/>);

		await userEvent.click(screen.getByRole('button', { name: 'Edit name' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' 2');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.getByRole('button', { name: 'Edit name' })).toHaveTextContent('Conto Corrente 2');
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
});

describe('the empty state', () => {
	test('names the action that fills the screen', () => {
		stubLedgerBridge();
		renderWithProviders(<EmptyState message='Nothing here yet.'><button type='button'>Add one</button></EmptyState>);

		expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument();
	});
});
