import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { renderWithProviders, stubLedgerBridge } from '../testUtils';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { DataTable } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { AmountField } from 'src/components/common/NumericFields';
import { RowMenu } from 'src/components/common/RowMenu';
import { SegmentedControl } from 'src/components/common/SegmentedControl';

// A form holds what the field hands it, which is what a save button is enabled against
const AmountFieldHarness = ({ initial }: { initial?: number }): ReactElement => {
	const [ value, setValue ] = useState<number | undefined>(initial);

	return (
		<>
			<AmountField value={value} label='Amount' minimum={0} required onChange={setValue}/>
			<output>{value === undefined ? 'nothing' : String(value)}</output>
			<button type='button'>Elsewhere</button>
		</>
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

describe('the one numeric field', () => {
	test('hands the caller nothing when a required figure is taken out of it, and goes on saying so', async() => {
		stubLedgerBridge();
		renderWithProviders(<AmountFieldHarness initial={1250}/>);

		const field = await screen.findByDisplayValue('12,50');

		await userEvent.clear(field);

		expect(screen.getByText('This is required.')).toBeInTheDocument();
		expect(screen.getByText('nothing')).toBeInTheDocument();

		// The figure is not put back the moment the field is left: there is nothing to go back to
		await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

		expect(screen.getByText('This is required.')).toBeInTheDocument();
		expect(field).toHaveValue('');
	});

	test('says a required field is required once it has been left empty, and not on opening', async() => {
		stubLedgerBridge();
		renderWithProviders(<AmountFieldHarness/>);

		expect(screen.queryByText('This is required.')).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole('textbox', { name: 'Amount' }));
		await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

		expect(screen.getByText('This is required.')).toBeInTheDocument();
	});

	// A refusal a keystroke raised goes with the keystrokes: the caller still holds the figure it had
	test('keeps the figure it had when one below the floor is typed, and drops the refusal when the field is left', async() => {
		stubLedgerBridge();
		renderWithProviders(<AmountFieldHarness initial={1250}/>);

		const field = await screen.findByDisplayValue('12,50');

		await userEvent.clear(field);
		await userEvent.type(field, '-');

		expect(screen.getByText('nothing')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

		expect(field).toHaveValue('');
	});
});

// One of the few is chosen, and the harness holds which so that pressing another is a change and not a no-op
const SegmentedControlHarness = (): ReactElement => {
	const [ value, setValue ] = useState<'1-year' | 'all'>('1-year');

	return (
		<SegmentedControl
			options={[ { key: '1-year', label: '1 year' }, { key: 'all', label: 'All' } ]}
			value={value}
			label='Period shown'
			onChange={setValue}/>
	);
};

describe('the segmented control', () => {
	test('is a group of real buttons saying which one is pressed, and never a tab list', async() => {
		stubLedgerBridge();
		renderWithProviders(<SegmentedControlHarness/>);

		const group = screen.getByRole('group', { name: 'Period shown' });

		expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
		expect(within(group).getByRole('button', { name: '1 year' })).toHaveAttribute('aria-pressed', 'true');
		expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');

		// The keyboard reaches every option and activates it, which is what makes them controls
		await userEvent.tab();
		await userEvent.tab();
		expect(screen.getByRole('button', { name: 'All' })).toHaveFocus();

		await userEvent.keyboard('{Enter}');
		expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: '1 year' })).toHaveAttribute('aria-pressed', 'false');
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
