import 'src/components/common/HintNote.css';
import type { ReactElement } from 'react';

/**
 * The note a figure carries beside it: what the figure is, what it leaves out, and whether it is an estimate.
 *
 * **It is a real button and not a marked-up character**, so the keyboard reaches it and draws the one focus ring around it, and
 * **the note itself is the button's name** rather than something a screen reader has to be steered towards — the popup beside it
 * is the same words, drawn for whoever is looking. It does nothing when it is pressed: there is nothing behind it but the words.
 *
 * The note is one string and carries no markup, so that it reads the same way to somebody hearing it as to somebody seeing it.
 *
 * **The note always opens downwards**, because the one place it is put inside something that scrolls is a table header, and a
 * table scrolls sideways. Where the mark is near the right edge of what encloses it — the last column of a table — the note is
 * hung from its right edge instead of centred on it, which is what keeps it inside.
 */

// Which edge of the mark the note is hung from. A note near the right edge of what encloses it is hung from that edge.
export type HintNoteAlignment = 'centre' | 'right';

export interface HintNoteProps {

	// The note. It is both what the popup says and what the control is called.
	children: string;

	align?: HintNoteAlignment;
}

/**
 * A note on a figure.
 * @param props The note's props.
 * @param props.children What it says.
 * @param props.align Which edge of the mark it is hung from, centred by default.
 * @returns The mark and the note beside it.
 */
export const HintNote = ({ children, align = 'centre' }: HintNoteProps): ReactElement => {
	return (
		<span className='hint-note'>
			<button type='button' className='hint-note-mark' aria-label={children}>ⓘ</button>
			<span className={align === 'right' ? 'hint-note-text hint-note-text-right' : 'hint-note-text'} aria-hidden='true'>
				{children}
			</span>
		</span>
	);
};
