/**
 * What a chart needs to be drawn at all in jsdom.
 *
 * The charting library measures the box it is put in, and jsdom lays nothing out and has no `ResizeObserver`, so a chart in a
 * test renders nothing until both are stood in for. Every test that asserts on a drawn chart calls this from `beforeAll`.
 */

// One box, reported for everything on the page. It is wide enough for a line and tall enough for the plot the stylesheet gives it.
const PLOT_WIDTH = 640;

const PLOT_HEIGHT = 200;

// jsdom has no ResizeObserver at all, so this one reports the fixed box the moment it is asked to watch anything
class FixedSizeResizeObserver implements ResizeObserver {
	private readonly callback: ResizeObserverCallback;

	public constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
	}

	public observe(target: Element): void {
		const entry = { target, contentRect: { width: PLOT_WIDTH, height: PLOT_HEIGHT } } as ResizeObserverEntry;

		this.callback([ entry ], this);
	}

	public unobserve(): void {
		return undefined;
	}

	public disconnect(): void {
		return undefined;
	}
}

/**
 * Reports a fixed box for everything on the page, so that the containers a chart is drawn inside measure something.
 */
export const stubChartLayout = (): void => {
	Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: FixedSizeResizeObserver });
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: PLOT_WIDTH });
	Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: PLOT_HEIGHT });
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: PLOT_WIDTH });
	Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: PLOT_HEIGHT });
};
