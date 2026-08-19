import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';

/**
 * How a chart's value axis writes an amount, which is the same wherever one is drawn.
 *
 * **An axis writes the amount at the coarsest scale it is short at** — `€ 240k` rather than `€ 240.000,00` — because a tick is
 * a label on a line and not a figure to be read to the cent. The full figure is one hover away, in the tooltip, and every other
 * amount on the screen is printed in full: this is the axis and nothing else. **A tick that has to wrap is the thing being
 * avoided**, the axis being given a fixed width and the label being broken across lines to fit it, which pushes the topmost
 * tick off the top of the chart and the bottom one down into the dates.
 *
 * It lives beside the chart rather than in `LineChart` itself, which knows nothing about money and is not to learn.
 * @returns The function an axis writes a figure with.
 */
export const useAmountAxisFormatter = (): (cents: number) => string => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const units = { thousands: t('chart.axisThousands'), millions: t('chart.axisMillions') };

	return (cents: number): string => {
		return formatter.compactAmount(cents, units);
	};
};
