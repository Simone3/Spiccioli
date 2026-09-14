import { decodeDelimitedText, parseDelimitedRows } from 'src/main/import/DelimitedGrid';

/**
 * The delimited reader. Every case here is one a bank export actually produces: a semicolon rather than a comma, a description
 * carrying the delimiter, a quoted field with a line break inside it, and a file written in the Windows code page.
 */

describe('splitting a delimited export', () => {
	test('splits on the character the template names and trims nothing', () => {
		expect(parseDelimitedRows('03/08/2026;Salary; 2480,55', ';')).toEqual([ [ '03/08/2026', 'Salary', ' 2480,55' ] ]);
	});

	test('takes a quoted field whole, delimiter and all', () => {
		expect(parseDelimitedRows('03/08/2026,"Esselunga, Milano",-84,20', ',')).toEqual([
			[ '03/08/2026', 'Esselunga, Milano', '-84', '20' ]
		]);
	});

	test('reads a doubled quote inside a quoted field as one quote', () => {
		expect(parseDelimitedRows('a,"Da ""Gino""",1', ',')).toEqual([ [ 'a', 'Da "Gino"', '1' ] ]);
	});

	test('keeps a line break that is inside a quoted field out of the rows', () => {
		expect(parseDelimitedRows('a,"one\ntwo",1\nb,c,2', ',')).toEqual([
			[ 'a', 'one\ntwo', '1' ],
			[ 'b', 'c', '2' ]
		]);
	});

	test('ends a row on any of the three line endings', () => {
		expect(parseDelimitedRows('a,1\r\nb,2\rc,3\nd,4', ',')).toEqual([
			[ 'a', '1' ],
			[ 'b', '2' ],
			[ 'c', '3' ],
			[ 'd', '4' ]
		]);
	});

	test('drops a byte-order mark rather than putting it in the first cell', () => {
		expect(parseDelimitedRows('﻿Date,Description', ',')).toEqual([ [ 'Date', 'Description' ] ]);
	});

	test('drops the blank rows an export ends with', () => {
		expect(parseDelimitedRows('a,1\n\n\n', ',')).toEqual([ [ 'a', '1' ] ]);
	});
});

describe('decoding the bytes', () => {
	test('reads a file written in the Windows code page, euro sign and accents included', () => {
		const bytes = Buffer.from([ 0x80, 0x20, 0x43, 0x69, 0x74, 0x74, 0xe0, 0x20, 0x96, 0x20, 0x41 ]);

		expect(decodeDelimitedText(bytes, 'windows-1252')).toBe('€ Città – A');
	});

	test('reads a file written in UTF-8', () => {
		expect(decodeDelimitedText(Buffer.from('€ Città', 'utf8'), 'utf-8')).toBe('€ Città');
	});
});
