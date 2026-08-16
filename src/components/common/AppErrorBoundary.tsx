import 'src/components/common/AppErrorBoundary.css';
import { type ReactElement, type ReactNode } from 'react';
import { ErrorBoundary } from 'src/framework/renderer/ErrorBoundary';
import { useTranslator } from 'src/i18n/TranslationContext';

// Wraps the whole application rather than one screen, so that a failure in a context provider above the router is caught too.
// Reloading is the recovery it offers: rendering the same tree again would usually only throw the same error a second time,
// while a reload starts over from what is on disk.
//
// The failure is written to the renderer console for now. That console is developer-facing and an installed Spiccioli cannot open
// it, so this screen still has to reach the operational log; the bridge that carries it there is written with the storage work.
const AppErrorBoundary = ({ children }: { children: ReactNode }): ReactElement => {
	const { t } = useTranslator();

	return (
		<ErrorBoundary
			onError={(error, componentStack) => {
				console.error('The renderer failed to draw', error, componentStack);
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
