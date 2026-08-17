import type { ReactElement } from 'react';
import { ConfirmDialog } from 'src/components/common/ConfirmDialog';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { CategorisationSummary } from 'src/logic/categories/Categorisation';

/**
 * What *Apply changes* asks before it writes anything.
 *
 * **What it shows is the consequence rather than the diff.** The draft is run over every transaction whose category the rules
 * own, and the four figures are what the file looks like once the list has been applied: how many rows change category, how
 * many lose one, how many gain one, and how many are untouched. **There is no breakdown by edit** — the decision being taken is
 * whether to apply the list as it now stands.
 *
 * **Confirm and the rules and every affected category are written together, in one step. Cancel and nothing at all is written**:
 * the draft is still on screen, exactly as it was, and can be edited further or discarded.
 */

export interface ApplyChangesDialogProps {
	summary: CategorisationSummary;

	// How many edits the draft is holding, which is what the heading counts
	pendingChanges: number;

	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * The confirmation.
 * @param props The dialog's props.
 * @param props.summary What applying the draft would do.
 * @param props.pendingChanges How many edits are waiting.
 * @param props.onConfirm What applying does.
 * @param props.onCancel What cancelling does, which is to write nothing and keep the draft.
 * @returns The dialog.
 */
export const ApplyChangesDialog = ({ summary, pendingChanges, onConfirm, onCancel }: ApplyChangesDialogProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();

	const figures: readonly { key: string; label: string; value: string }[] = [
		{ key: 'changed', label: t('rules.apply.changed'), value: formatter.integer(summary.changed) },
		{ key: 'lost', label: t('rules.apply.lost'), value: formatter.integer(summary.lost) },
		{ key: 'gained', label: t('rules.apply.gained'), value: formatter.integer(summary.gained) },
		{
			key: 'unchanged',
			label: t('rules.apply.unchanged'),
			value: t('rules.apply.unchangedOf', {
				unchanged: formatter.integer(summary.unchanged),
				total: formatter.integer(summary.total)
			})
		}
	];

	return (
		<ConfirmDialog
			title={t('rules.apply.title')}
			message={
				<>
					<p className='categories-screen-apply-lead'>{t('rules.apply.lead', { count: pendingChanges })}</p>
					<dl className='categories-screen-apply-figures'>
						{figures.map((figure) => {
							return (
								<div key={figure.key} className='categories-screen-apply-figure'>
									<dt>{figure.label}</dt>
									<dd>{figure.value}</dd>
								</div>
							);
						})}
					</dl>
					<p className='categories-screen-apply-note'>{t('rules.apply.note')}</p>
				</>
			}
			confirmLabel={t('rules.apply.confirm')}
			onConfirm={onConfirm}
			onCancel={onCancel}/>
	);
};
