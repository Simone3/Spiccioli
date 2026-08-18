import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { renderWithProviders, stubLedgerBridge } from '../testUtils';
import { DateField } from 'src/components/common/DateField';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { DateFormat } from 'src/types/PreferencesTypes';
import type { IsoDate } from 'src/types/LedgerTypes';

const DateFieldHarness = ({ initial }: { initial?: IsoDate }): ReactElement => {
	const [ value, setValue ] = useState<IsoDate | undefined>(initial);

	return (
		<>
			<DateField value={value} label='Date' onChange={setValue}/>
			<output>{value ?? 'nothing'}</output>
		</>
	);
};

const renderDateField = async(initial?: IsoDate, dateFormat: DateFormat = DEFAULT_PREFERENCES.dateFormat): Promise<void> => {
	stubLedgerBridge({
		getPreferences: () => {
			return Promise.resolve({ ...DEFAULT_PREFERENCES, dateFormat });
		}
	});

	renderWithProviders(<DateFieldHarness initial={initial}/>);
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

	test('refuses a day after today, which never reaches the caller', async() => {
		const nextYear = new Date().getFullYear() + 1;
		await renderDateField();

		await userEvent.type(screen.getByRole('textbox', { name: 'Date' }), `08/08/${nextYear}`);

		expect(screen.queryByText(`${nextYear}-08-08`)).not.toBeInTheDocument();
	});
});
