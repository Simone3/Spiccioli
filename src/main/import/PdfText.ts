import { PDF_TEXT_CONFIG } from 'src/config/AppConfig';

/**
 * A PDF read out as the lines of text it prints, and nothing else.
 *
 * **This is the one module in the application that imports the PDF library** ([§8.3](../../../docs/technical/08-decisions.md#83-the-dependencies-the-application-adds)),
 * the way the price provider is the one thing behind an adapter: what leaves here is an array of strings, so nothing above it
 * has a PDF in it and swapping the library out is a change to this file.
 *
 * **A PDF has no rows.** What a document carries is pieces of text at positions on a page, and the lines a reader sees are
 * something the eye does rather than something the file states. So the pieces are grouped back into lines by the baseline they
 * sit on and ordered left to right along it — which is all a payslip template needs, every figure on one being printed on the
 * same line as the words naming it.
 *
 * **A figure crosses as the characters the page spells it with**, like every other cell an import reads: what a `2.500,00`
 * means is the template's business and the amount parser's, and neither of them is here ([§8.2](../../../docs/technical/08-decisions.md#82-what-d3-fixes)).
 *
 * **Nothing is rendered.** Only the text layer is asked for, so a document whose text is a picture of one — a scan, a
 * photograph — comes back with no lines at all and is refused above, and no font, image or colour is ever decoded.
 *
 * **The library is loaded the first time a document is read and not when the process starts.** It is a megabyte of code that
 * announces on the console what it would need to draw a page with, and a run that never imports a payslip has no use for
 * either — so the import is where the reading is, and the start-up of a session that opens a file and looks at it carries
 * nothing of this.
 */

// Where a text item's position sits in the transform the library hands back with it
const ITEM_TRANSFORM = {
	x: 4,
	y: 5
} as const;

export type ReadPdfLinesResult = {
	outcome: 'lines';

	// One entry per printed line, each holding the pieces of text along it from left to right
	lines: string[][];
} | {

	// The bytes are not a PDF, or are one nothing can be opened out of: encrypted, truncated, or written to no standard at all
	outcome: 'not-a-pdf';
};

interface PositionedText {
	text: string;
	x: number;
	y: number;
}

/**
 * Groups the pieces of text on one page into the lines they are printed as.
 *
 * **Two pieces are on the same line when their baselines are within a hair of each other**, rather than when they are equal: a
 * document is free to nudge a figure a fraction of a point off the words beside it, and a reader would still call that one
 * line. The tolerance is [`PDF_TEXT_CONFIG`](../../config/AppConfig.ts)'s and is a fraction of a line's height, so two real
 * lines are never folded into one.
 * @param items The pieces of text on the page, in no particular order.
 * @returns The lines, top to bottom, each left to right.
 */
const linesOf = (items: readonly PositionedText[]): string[][] => {
	// Down the page first and across it second, which is the order the lines are then cut out of
	const ordered = [ ...items ].sort((left, right) => {
		return Math.abs(left.y - right.y) <= PDF_TEXT_CONFIG.lineTolerancePoints ? left.x - right.x : right.y - left.y;
	});
	const lines: string[][] = [];
	let baseline: number | undefined;

	ordered.forEach((item) => {
		if(baseline === undefined || Math.abs(item.y - baseline) > PDF_TEXT_CONFIG.lineTolerancePoints) {
			baseline = item.y;
			lines.push([]);
		}

		lines[lines.length - 1].push(item.text);
	});

	return lines;
};

/**
 * Reads a PDF out as the lines of text it prints.
 *
 * **Every page is read and the pages follow one another**, a payslip printing its figures across two of them as readily as
 * across one. A page carrying no text at all contributes no lines rather than an empty one.
 * @param bytes The whole file.
 * @returns The lines, or the one refusal there is.
 */
export const readPdfLines = async(bytes: Buffer): Promise<ReadPdfLinesResult> => {
	const { getDocument, VerbosityLevel } = await import('pdfjs-dist/legacy/build/pdf.mjs');
	let document;

	try {
		// A copy, the library taking ownership of the array it is handed and the caller's buffer being none of its business
		document = await getDocument({
			data: new Uint8Array(bytes),

			// Nothing here renders, so no font is ever installed, drawn with or looked for on the machine
			useSystemFonts: false,
			disableFontFace: true,

			// **Nothing leaves the machine**: the library is able to fetch character maps and font data over the network, and this
			// is what says it may not ([§8.1](../../../docs/technical/08-decisions.md#81-the-fourteen-decisions) D11)
			useWorkerFetch: false,

			// The library writes to the console of its own accord, and what it has to say is about drawing a page: a font it would
			// have had to fetch to render with, a polyfill a browser would have had. Nothing here draws anything, so only its
			// errors are worth a line — and the one the application keeps is the refusal below, in the log Spiccioli owns.
			verbosity: VerbosityLevel.ERRORS
		}).promise;
	}
	catch {
		return { outcome: 'not-a-pdf' };
	}

	const lines: string[][] = [];

	try {
		for(let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
			const page = await document.getPage(pageNumber);
			const content = await page.getTextContent();
			const items: PositionedText[] = [];

			content.items.forEach((item) => {
				if(!('str' in item) || item.str.trim() === '') {
					return;
				}

				// The library types a text item's placement on the page as an array of anything, and it is six numbers
				const placement = item.transform as number[];

				items.push({ text: item.str.trim(), x: placement[ITEM_TRANSFORM.x], y: placement[ITEM_TRANSFORM.y] });
			});

			lines.push(...linesOf(items));
		}
	}
	catch {
		return { outcome: 'not-a-pdf' };
	}
	finally {
		await document.loadingTask.destroy();
	}

	return { outcome: 'lines', lines };
};
