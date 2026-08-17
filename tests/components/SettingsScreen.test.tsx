import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderOpenLedger, TEST_LEDGER_PATH } from '../testUtils';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { Preferences } from 'src/types/PreferencesTypes';

const openSettings = async(overrides: Parameters<typeof renderOpenLedger>[1] = {}): Promise<void> => {
	await renderOpenLedger(undefined, overrides);
	await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
};

describe('the Settings screen', () => {
	test('says the preferences belong to the application rather than to the open file', async() => {
		await openSettings();

		expect(screen.getByText('These settings belong to Spiccioli, not to the open file.')).toBeInTheDocument();
	});

	test('states where the open file is and where its copies are, as read-only facts', async() => {
		await openSettings();

		expect(screen.getByText(TEST_LEDGER_PATH)).toBeInTheDocument();
		expect(screen.getByText('/Documents/finances-backups')).toBeInTheDocument();
	});

	test('writes a preference the moment it changes, with no save button', async() => {
		const written: Preferences[] = [];
		await openSettings({
			setPreferences: (preferences) => {
				written.push(preferences);

				return Promise.resolve();
			}
		});

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Date format' }), 'YYYY-MM-DD');

		expect(written).toHaveLength(1);
		expect(written[0].dateFormat).toBe('YYYY-MM-DD');
		expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
	});

	test('re-renders every figure on screen the moment a separator changes', async() => {
		await openSettings();

		expect(screen.getByRole('textbox', { name: 'Default tax rate' })).toHaveValue('26,0');

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Thousands separator' }), 'space');
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Decimal separator' }), 'dot');

		expect(screen.getByRole('textbox', { name: 'Default tax rate' })).toHaveValue('26.0');
	});

	test('refuses a thousands separator that collides with the decimal one, leaving the previous value in force', async() => {
		const written: Preferences[] = [];
		await openSettings({
			setPreferences: (preferences) => {
				written.push(preferences);

				return Promise.resolve();
			}
		});

		const thousands = screen.getByRole('combobox', { name: 'Thousands separator' });

		await userEvent.selectOptions(thousands, 'comma');

		expect(screen.getByText('The decimal and thousands separators must differ, so this one was not applied.')).toBeInTheDocument();
		expect(thousands).toHaveValue(DEFAULT_PREFERENCES.thousandsSeparator);
		expect(written).toHaveLength(0);
	});

	test('takes none as a thousands separator, which never collides', async() => {
		const written: Preferences[] = [];
		await openSettings({
			setPreferences: (preferences) => {
				written.push(preferences);

				return Promise.resolve();
			}
		});

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Thousands separator' }), 'none');

		expect(written[0].thousandsSeparator).toBe('none');
	});

	test('refuses a figure outside a preference bounds in place, and applies one inside them', async() => {
		const written: Preferences[] = [];
		await openSettings({
			setPreferences: (preferences) => {
				written.push(preferences);

				return Promise.resolve();
			}
		});

		const window = screen.getByRole('textbox', { name: 'Transfer match window' });

		await userEvent.clear(window);
		await userEvent.type(window, '40');

		expect(screen.getByText('This cannot be more than 31.')).toBeInTheDocument();
		expect(written.some((preferences) => {
			return preferences.transferMatchWindowDays === 40;
		})).toBe(false);

		await userEvent.clear(window);
		await userEvent.type(window, '7');

		expect(written[written.length - 1].transferMatchWindowDays).toBe(7);
	});
});

describe('the numeric field', () => {
	test('refuses what cannot be typed into an amount, as it is typed', async() => {
		await openSettings();

		const backups = screen.getByRole('textbox', { name: 'Backups kept' });

		await userEvent.clear(backups);
		await userEvent.type(backups, '1a2');

		expect(backups).toHaveValue('12');
	});

	test('will not take more decimals than the field carries', async() => {
		await openSettings();

		const taxRate = screen.getByRole('textbox', { name: 'Default tax rate' });

		await userEvent.clear(taxRate);
		await userEvent.type(taxRate, '12,55');

		expect(taxRate).toHaveValue('12,5');
	});
});
