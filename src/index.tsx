import '@fontsource/inter/300.css';
import '@fontsource/inter/700.css';
import 'src/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppErrorBoundary } from 'src/components/common/AppErrorBoundary';
import { SpiccioliApp } from 'src/components/SpiccioliApp';
import { LedgerProvider } from 'src/contexts/LedgerContext';
import { PreferencesProvider } from 'src/contexts/PreferencesContext';
import { TranslationProvider } from 'src/i18n/TranslationContext';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
	<React.StrictMode>
		<TranslationProvider>
			<AppErrorBoundary>
				<PreferencesProvider>
					<LedgerProvider>
						<SpiccioliApp/>
					</LedgerProvider>
				</PreferencesProvider>
			</AppErrorBoundary>
		</TranslationProvider>
	</React.StrictMode>
);
