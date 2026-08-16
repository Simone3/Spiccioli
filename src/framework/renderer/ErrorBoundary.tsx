import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches the render errors below it, so one broken component does not leave the user with an empty window.
 *
 * React unmounts the whole tree when a render throws and nothing catches it, which shows a blank page with no message and no way
 * back. This holds on to the failure and asks the application what to show instead: the wording and the recovery both belong to
 * the application, so this owns only the catching.
 */

export interface ErrorBoundaryFallbackOptions {
	error: unknown;

	// Renders the children again, for a failure the application believes is over. A reload is the safer recovery when it cannot tell.
	reset: () => void;
}

export interface ErrorBoundaryProps {
	children: ReactNode;
	renderFallback: (options: ErrorBoundaryFallbackOptions) => ReactNode;

	// Called with every caught failure, for the application to leave a trace of. It runs during React's commit phase, so it must not throw.
	onError?: (error: unknown, componentStack: string | undefined) => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: unknown;
}

// A class on purpose: catching a render error is the one thing React has no hook for
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	public constructor(props: ErrorBoundaryProps) {
		super(props);

		this.state = {
			hasError: false,
			error: undefined
		};
	}

	public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
		return {
			hasError: true,
			error
		};
	}

	public componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
		this.props.onError?.(error, errorInfo.componentStack ?? undefined);
	}

	// An arrow property rather than a method, so that the fallback can be handed the reset on its own without losing "this"
	private readonly reset = (): void => {
		this.setState({
			hasError: false,
			error: undefined
		});
	};

	public render(): ReactNode {
		if(this.state.hasError) {
			return this.props.renderFallback({
				error: this.state.error,
				reset: this.reset
			});
		}

		return this.props.children;
	}
}
