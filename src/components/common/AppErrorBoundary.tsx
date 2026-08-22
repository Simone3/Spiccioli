import 'src/components/common/AppErrorBoundary.css';
import { type ReactElement, type ReactNode } from 'react';
import { ErrorBoundary } from 'src/framework/renderer/ErrorBoundary';
import { RENDERER_LANGUAGE } from 'src/i18n/TranslationContext';
import { createSpiccioliTranslator } from 'src/i18n/Translations';

// Wraps the whole application rather than one screen, so that a failure in a context provider above the router is caught too.
// Reloading is the recovery it offers: rendering the same tree again would usually only throw the same error a second time,
// while a reload starts over from what is on disk.
//
// **Its wording comes from a translator of its own rather than from the context**, because it is mounted above every provider:
// what it has to be able to report is one of them failing, and a crash screen that reads the tree it is replacing would go down
// with it. Nothing is lost by it — the language is resolved once at load and no screen can change it.
//
// The failure goes to the operational log by way of the main process, because the renderer console is developer-facing and an
// installed Spiccioli cannot open it. It is still written to that console as well, which is where it is read during development.
// The main process decides what the entry is called and how long each of the three texts may be.

const { t } = createSpiccioliTranslator(RENDERER_LANGUAGE);

const AppErrorBoundary = ({ children }: { children: ReactNode }): ReactElement => {
	return (
		<ErrorBoundary
			onError={(error, componentStack) => {
				console.error('The renderer failed to draw', error, componentStack);

				// Reporting the failure must never be able to fail on top of it
				void Promise.resolve().then(() => {
					return window.spiccioliDiagnostics.reportRenderError({
						message: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
						componentStack: componentStack ?? undefined
					});
				}).catch(() => {
					// Intentionally ignored
				});
			}}
			renderFallback={() => {
				return (
					<div className='app-error-boundary' role='alert'>
						<div className='app-error-boundary-panel'>
							<h1 className='app-error-boundary-title'>{t('crash.title')}</h1>
							<p className='app-error-boundary-message'>{t('crash.message')}</p>
							<button
								type='button'
								className='app-error-boundary-reload'
								onClick={() => {
									window.location.reload();
								}}>
								{t('crash.reload')}
							</button>
						</div>
					</div>
				);
			}}>
			{children}
		</ErrorBoundary>
	);
};

export { AppErrorBoundary };
