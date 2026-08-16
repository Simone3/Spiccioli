import { screen, waitFor } from '@testing-library/react';
import { renderWithTranslations } from '../testUtils';
import { PlaceholderPage } from 'src/components/common/PlaceholderPage';
import type { SpiccioliAppInfoApi } from 'src/types/AppInfoTypes';

const stubAppInfoBridge = (getAppInfo: SpiccioliAppInfoApi['getAppInfo']): void => {
	Object.defineProperty(window, 'spiccioliAppInfo', {
		configurable: true,
		value: { getAppInfo } satisfies SpiccioliAppInfoApi
	});
};

describe('PlaceholderPage', () => {
	test('shows what the main process reported about the running build', async() => {
		stubAppInfoBridge(() => {
			return Promise.resolve({
				version: '0.1.0',
				platform: 'darwin'
			});
		});

		renderWithTranslations(<PlaceholderPage/>);

		expect(screen.getByRole('heading', { name: 'Spiccioli' })).toBeInTheDocument();
		await waitFor(() => {
			expect(screen.getByText('Version 0.1.0 on darwin')).toBeInTheDocument();
		});
	});

	// The bridge is the only thing on this screen that can fail, and a screen that silently says nothing would not show that it did
	test('says so when the bridge does not answer', async() => {
		stubAppInfoBridge(() => {
			return Promise.reject(new Error('No handler registered'));
		});

		renderWithTranslations(<PlaceholderPage/>);

		await waitFor(() => {
			expect(screen.getByText('The main process did not answer.')).toBeInTheDocument();
		});
	});
});
