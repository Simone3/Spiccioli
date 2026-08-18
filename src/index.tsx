import '@fontsource/inter/300.css';
import '@fontsource/inter/700.css';
import 'src/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppErrorBoundary } from 'src/components/common/AppErrorBoundary';
import { SpiccioliApp } from 'src/components/SpiccioliApp';
import { ChecksProvider } from 'src/contexts/ChecksContext';
import { LedgerProvider } from 'src/contexts/LedgerContext';
import { PreferencesProvider } from 'src/contexts/PreferencesContext';
import { UnsavedDraftProvider } from 'src/contexts/UnsavedDraftContext';
import { TranslationProvider } from 'src/i18n/TranslationContext';

// The router is installed once, here. It is a hash history because a packaged run loads the built page over "file://", where a
// path-based history has nothing to write into.
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
	<React.StrictMode>
		<TranslationProvider>
			<AppErrorBoundary>
				<PreferencesProvider>
					<UnsavedDraftProvider>
						<LedgerProvider>
							<ChecksProvider>
								<HashRouter>
									<SpiccioliApp/>
								</HashRouter>
							</ChecksProvider>
						</LedgerProvider>
					</UnsavedDraftProvider>
				</PreferencesProvider>
			</AppErrorBoundary>
		</TranslationProvider>
	</React.StrictMode>
);
