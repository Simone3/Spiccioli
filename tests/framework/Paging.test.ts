import { FIRST_PAGE, pageCountOf, pageHolding, pageOf } from 'src/framework/utils/Paging';

// Twenty-five rows over a page of ten: two full pages and a short one
const ROWS = Array.from({ length: 25 }, (_, position) => {
	return `row-${position + 1}`;
});

const ROWS_PER_PAGE = 10;

const holdingRow = (name: string): number => {
	return pageHolding(ROWS, (row) => {
		return row === name;
	}, ROWS_PER_PAGE);
};

describe('Paging', () => {
	test('counts the pages a list makes, the last one short', () => {
		expect(pageCountOf(25, ROWS_PER_PAGE)).toBe(3);
		expect(pageCountOf(20, ROWS_PER_PAGE)).toBe(2);
		expect(pageCountOf(1, ROWS_PER_PAGE)).toBe(1);
	});

	test('an empty list still makes one page, which is where the empty state is shown', () => {
		expect(pageCountOf(0, ROWS_PER_PAGE)).toBe(FIRST_PAGE);
	});

	test('takes a page out of the list, counting from one', () => {
		expect(pageOf(ROWS, 1, ROWS_PER_PAGE)[0]).toBe('row-1');
		expect(pageOf(ROWS, 2, ROWS_PER_PAGE)[0]).toBe('row-11');
		expect(pageOf(ROWS, 2, ROWS_PER_PAGE)).toHaveLength(ROWS_PER_PAGE);
	});

	test('the last page holds what is left of the list and no more', () => {
		expect(pageOf(ROWS, 3, ROWS_PER_PAGE)).toEqual([ 'row-21', 'row-22', 'row-23', 'row-24', 'row-25' ]);
	});

	test('a page past the end is empty rather than refused', () => {
		expect(pageOf(ROWS, 4, ROWS_PER_PAGE)).toEqual([]);
	});

	test('finds the page a row sits on', () => {
		expect(holdingRow('row-1')).toBe(1);
		expect(holdingRow('row-10')).toBe(1);
		expect(holdingRow('row-11')).toBe(2);
		expect(holdingRow('row-25')).toBe(3);
	});

	test('a row the list does not hold reads as the first page', () => {
		expect(holdingRow('row-99')).toBe(FIRST_PAGE);
	});
});
