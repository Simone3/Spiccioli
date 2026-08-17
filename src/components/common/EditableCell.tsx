import { useState, type ReactElement, type ReactNode } from 'react';
import { InlineEditCell } from 'src/components/common/InlineEditCell';

/**
 * A cell edited in place, and the value being typed into it.
 *
 * `InlineEditCell` owns whether the cell is open and what a refusal looks like; this owns **the value being edited**, which is
 * the part every screen would otherwise write again. The edit is held here and nowhere else until it is taken, so **a refused
 * value never reaches the record** and abandoning the edit puts back what the row already held.
 *
 * The value the editor is handed is the draft while one is being typed and the record's own value otherwise, so a row that
 * changed under a closed cell is edited from what it now holds rather than from what it held when the screen was drawn.
 */

export interface EditableCellProps<TValue> {

	// What the record holds, which is what the editor opens on
	value: TValue;

	// What the control that opens the editor is called, which is what tells one row's cell from another's
	label: string;

	// What the cell reads while it is closed
	children: ReactNode;

	renderEditor: (value: TValue, onChange: (next: TValue) => void) => ReactNode;

	// Takes the value. Returns nothing when it was taken, or the reason it was refused.
	onCommit: (value: TValue) => string | undefined;

	disabled?: boolean;
}

/**
 * The one cell edited in place.
 * @param props The cell's props.
 * @param props.value What the record holds.
 * @param props.label What the control that opens the editor is called.
 * @param props.children What the cell reads while it is closed.
 * @param props.renderEditor The editor, handed the value being edited and how to change it.
 * @param props.onCommit What taking the value does, and what says it could not be taken.
 * @param props.disabled Whether the cell can be edited at all.
 * @returns The cell.
 */
export const EditableCell = <TValue, >({ value, label, children, renderEditor, onCommit, disabled }: EditableCellProps<TValue>): ReactElement => {
	// Wrapped rather than held bare, so that a draft of undefined is still a draft: an emptied amount field is a value being edited
	const [ draft, setDraft ] = useState<{ value: TValue } | undefined>(undefined);
	const edited = draft ? draft.value : value;

	return (
		<InlineEditCell
			label={label}
			disabled={disabled}
			renderEditor={() => {
				return renderEditor(edited, (next) => {
					setDraft({ value: next });
				});
			}}
			onCommit={() => {
				const refusal = onCommit(edited);

				if(!refusal) {
					setDraft(undefined);
				}

				return refusal;
			}}
			onCancel={() => {
				setDraft(undefined);
			}}>
			{children}
		</InlineEditCell>
	);
};
