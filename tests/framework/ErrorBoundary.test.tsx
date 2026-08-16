import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { ErrorBoundary } from 'src/framework/renderer/ErrorBoundary';

// React writes every caught error to the console on its own, which would bury the test output
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const Boom = ({ shouldThrow }: { shouldThrow: boolean }): ReactElement => {
	if(shouldThrow) {
		throw new Error('The task list could not be rendered');
	}

	return <div>Tasks</div>;
};

// Throws for as long as the test says it should, so that resetting the boundary has something working to go back to. The switch
// lives outside React on purpose: a component that threw while rendering keeps nothing from that render, and React renders the
// failing tree a second time before handing the error to the boundary.
const createBreakableComponent = (): { component: () => ReactElement; repair: () => void } => {
	const state = { isBroken: true };

	return {
		component: () => {
			if(state.isBroken) {
				throw new Error('The task list could not be rendered');
			}

			return <div>Tasks</div>;
		},
		repair: () => {
			state.isBroken = false;
		}
	};
};

const renderFallback = ({ reset }: { reset: () => void }): ReactElement => {
	return (
		<div>
			<span>Something went wrong</span>
			<button onClick={reset}>Try again</button>
		</div>
	);
};

describe('ErrorBoundary', () => {
	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
			return undefined;
		});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	test('renders its children while nothing throws', () => {
		render(
			<ErrorBoundary renderFallback={renderFallback}>
				<Boom shouldThrow={false}/>
			</ErrorBoundary>
		);

		expect(screen.getByText('Tasks')).toBeInTheDocument();
		expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
	});

	test('shows the fallback instead of an empty page once a render throws', () => {
		render(
			<ErrorBoundary renderFallback={renderFallback}>
				<Boom shouldThrow={true}/>
			</ErrorBoundary>
		);

		expect(screen.getByText('Something went wrong')).toBeInTheDocument();
		expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
	});

	test('hands the failure and the component that threw to the application', () => {
		const onError = vi.fn();

		render(
			<ErrorBoundary renderFallback={renderFallback} onError={onError}>
				<Boom shouldThrow={true}/>
			</ErrorBoundary>
		);

		expect(onError).toHaveBeenCalledTimes(1);
		expect((onError.mock.calls[0]?.[0] as Error).message).toBe('The task list could not be rendered');
		expect(onError.mock.calls[0]?.[1]).toContain('Boom');
	});

	test('gives the failure to the fallback, which decides what to say about it', () => {
		render(
			<ErrorBoundary
				renderFallback={({ error }) => {
					return <span>{(error as Error).message}</span>;
				}}>
				<Boom shouldThrow={true}/>
			</ErrorBoundary>
		);

		expect(screen.getByText('The task list could not be rendered')).toBeInTheDocument();
	});

	test('renders the children again once the fallback resets it', async() => {
		const user = userEvent.setup();
		const { component: Breakable, repair } = createBreakableComponent();

		render(
			<ErrorBoundary renderFallback={renderFallback}>
				<Breakable/>
			</ErrorBoundary>
		);

		expect(screen.getByText('Something went wrong')).toBeInTheDocument();

		repair();
		await user.click(screen.getByRole('button', { name: 'Try again' }));

		expect(screen.getByText('Tasks')).toBeInTheDocument();
		expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
	});
});
