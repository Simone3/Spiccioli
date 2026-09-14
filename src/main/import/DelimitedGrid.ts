/**
 * A delimited export read out as a grid.
 *
 * **What the box takes is tabs, and what a bank writes is commas or semicolons**, so a delimited file is split here by the
 * character its template names and handed over as cells. Quoting is the reason this is not a call to `split`: a description
 * carrying the delimiter, or a line break, is written quoted, and a reader that ignored the quotes would tear a row in half.
 *
 * **The encoding is the template's to state and is never sniffed.** An export written in the Windows code page and read as
 * UTF-8 loses every accented character, and one read the other way round loses nothing but is wrong about the euro sign — so
 * the template says which it is, as it says everything else.
 */

const QUOTE = '"';

const BYTE_ORDER_MARK = '﻿';

const CARRIAGE_RETURN = '\r';

const LINE_FEED = '\n';

// The 32 places where the Windows code page and ISO-8859-1 disagree, which is where the euro sign and the typographic quotes
// live. Every other byte means the same thing in both, so decoding is the one table plus a pass-through.
const WINDOWS_1252_HIGH_RANGE_START = 0x80;

const WINDOWS_1252_HIGH_RANGE: readonly string[] = [
	'€', '', '‚', 'ƒ', '„', '…', '†', '‡',
	'ˆ', '‰', 'Š', '‹', 'Œ', '', 'Ž', '',
	'', '‘', '’', '“', '”', '•', '–', '—',
	'˜', '™', 'š', '›', 'œ', '', 'ž', 'Ÿ'
];

/**
 * Turns the bytes into text under the encoding the template names.
 * @param bytes The whole file.
 * @param encoding What the template says the bytes spell text in.
 * @returns The text.
 */
export const decodeDelimitedText = (bytes: Buffer, encoding: 'utf-8' | 'windows-1252'): string => {
	if(encoding === 'utf-8') {
		return bytes.toString('utf8');
	}

	let text = '';

	for(const byte of bytes) {
		const high = byte - WINDOWS_1252_HIGH_RANGE_START;

		text += high >= 0 && high < WINDOWS_1252_HIGH_RANGE.length ? WINDOWS_1252_HIGH_RANGE[high] : String.fromCharCode(byte);
	}

	return text;
};

/**
 * Splits a delimited document into rows of cells.
 *
 * **A quoted field is taken whole**, delimiters, line breaks and doubled quotes inside it included, and an unterminated quote
 * simply runs to the end of the file rather than raising anything: what it produces is a row the screen will mark, which is
 * where every other malformed row is reported too.
 * @param text The document.
 * @param delimiter The character the template says separates columns.
 * @returns One entry per row, each holding its cells.
 */
export const parseDelimitedRows = (text: string, delimiter: string): string[][] => {
	const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
	const rows: string[][] = [];
	let cells: string[] = [];
	let cell = '';
	let quoted = false;

	const endCell = (): void => {
		cells.push(cell);
		cell = '';
	};

	const endRow = (): void => {
		endCell();
		rows.push(cells);
		cells = [];
	};

	for(let index = 0; index < body.length; index++) {
		const character = body[index];

		if(quoted) {
			if(character !== QUOTE) {
				cell += character;
			}
			else if(body[index + 1] === QUOTE) {
				cell += QUOTE;
				index += 1;
			}
			else {
				quoted = false;
			}

			continue;
		}

		if(character === QUOTE && cell === '') {
			quoted = true;
		}
		else if(character === delimiter) {
			endCell();
		}
		else if(character === LINE_FEED) {
			endRow();
		}
		else if(character === CARRIAGE_RETURN) {
			if(body[index + 1] === LINE_FEED) {
				index += 1;
			}

			endRow();
		}
		else {
			cell += character;
		}
	}

	if(cell !== '' || cells.length > 0) {
		endRow();
	}

	while(rows.length > 0 && rows[rows.length - 1].every((entry) => {
		return entry.trim() === '';
	})) {
		rows.pop();
	}

	return rows;
};
