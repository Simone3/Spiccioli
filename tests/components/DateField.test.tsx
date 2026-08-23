import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { renderWithProviders, stubLedgerBridge } from '../testUtils';
import { DateField } from 'src/components/common/DateField';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { DateFormat } from 'src/types/PreferencesTypes';
import type { IsoDate } from 'src/types/LedgerTypes';

const DateFieldHarness = ({ initial, required }: { initial?: IsoDate; required?: boolean }): ReactElement => {
	const [ value, setValue ] = useState<IsoDate | undefined>(initial);

	return (
		<>
			<DateField value={value} label='Date' required={required} onChange={setValue}/>
			<output>{value ?? 'nothing'}</output>
			<button type='button'>Elsewhere</button>
		</>
	);
};

const renderDateField = async(initial?: IsoDate, dateFormat: DateFormat = DEFAULT_PREFERENCES.dateFormat, required?: boolean): Promise<void> => {
	stubLedgerBridge({
		getPreferences: () => {
			return Promise.resolve({ ...DEFAULT_PREFERENCES, dateFormat });
		}
	});

	renderWithProviders(<DateFieldHarness initial={initial} required={required}/>);
	await screen.findByRole('textbox', { name: 'Date' });
};

describe('the date field', () => {
	// The preferences reach the field over the bridge, so the day is awaited rather than read the moment the input exists
	test('prints the day in the format the preferences hold', async() => {
		await renderDateField('2026-08-08');

		expect(await screen.findByDisplayValue('08/08/2026')).toBeInTheDocument();
	});

	test('follows the preference rather than a system locale', async() => {
		await renderDateField('2026-08-08', 'YYYY-MM-DD');

		expect(await screen.findByDisplayValue('2026-08-08')).toBeInTheDocument();
	});

	test('will not take a character that is neither a digit nor the format separator', async() => {
		await renderDateField();

		const field = screen.getByRole('textbox', { name: 'Date' });

		await userEvent.type(field, '08a08');

		expect(field).toHaveValue('0808');
	});

	test('takes a day that has happened', async() => {
		await renderDateField();

		await userEvent.type(screen.getByRole('textbox', { name: 'Date' }), '08/08/2020');

		expect(screen.getByText('2020-08-08')).toBeInTheDocument();
	});

	// A form opens on the record it is about to create, not on a refusal of a field nobody has been in yet
	test('says a required field is required once it has been left empty, and not on opening', async() => {
		await renderDateField(undefined, DEFAULT_PREFERENCES.dateFormat, true);

		expect(screen.queryByText('This is required.')).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole('textbox', { name: 'Date' }));
		await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

		expect(screen.getByText('This is required.')).toBeInTheDocument();
	});

	test('says it again when the day in it is taken out', async() => {
		await renderDateField('2020-08-08', DEFAULT_PREFERENCES.dateFormat, true);

		expect(screen.queryByText('This is required.')).not.toBeInTheDocument();

		await userEvent.clear(await screen.findByDisplayValue('08/08/2020'));

		expect(screen.getByText('This is required.')).toBeInTheDocument();
	});

	// A three-digit year is a real year to the parser, and "202-02-01" is a day the reader refuses the whole file for
	test('refuses a year that has not been typed out, which never reaches the caller', async() => {
		await renderDateField(undefined, DEFAULT_PREFERENCES.dateFormat, true);

		await userEvent.type(screen.getByRole('textbox', { name: 'Date' }), '01/02/202');
		await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

		expect(screen.getByText('nothing')).toBeInTheDocument();
		expect(screen.getByText('This is required.')).toBeInTheDocument();
	});

	test('keeps the day it had when a digit is taken off the year of it', async() => {
		await renderDateField('2020-08-08');

		await userEvent.type(await screen.findByDisplayValue('08/08/2020'), '{backspace}');
		await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

		expect(screen.getByText('2020-08-08')).toBeInTheDocument();
	});

	// A field already in hand is clicked again all the time, and the click must not take the caret out of the box it just landed in
	test('is still typed in after a second click on the field the calendar is already open under', async() => {
		await renderDateField();

		const field = screen.getByRole('textbox', { name: 'Date' });

		await userEvent.click(field);
		await userEvent.click(field);
		await userEvent.type(field, '08/08/2020');

		expect(screen.getByText('2020-08-08')).toBeInTheDocument();
	});

	test('refuses a day after today, which never reaches the caller', async() => {
		const nextYear = new Date().getFullYear() + 1;
		await renderDateField();

		await userEvent.type(screen.getByRole('textbox', { name: 'Date' }), `08/08/${nextYear}`);

		expect(screen.queryByText(`${nextYear}-08-08`)).not.toBeInTheDocument();
	});
});
