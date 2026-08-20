/**
 * The arithmetic behind a paged table: how many pages a list makes, which rows one page holds, and which page a row sits on.
 *
 * Nothing here decides how long a page is — the size is passed in, so two tables paging at two different lengths share the one
 * implementation. **A page counts from one**, the number being a thing a user reads and types, and an empty list still makes one
 * page: the page the empty state is shown on.
 */

/** The page every paged list opens on, and the one a change of what it holds lands back on. */
export const FIRST_PAGE = 1;

/**
 * How many pages a number of rows makes.
 * @param count How many rows there are.
 * @param rowsPerPage How many rows a page holds.
 * @returns The number of pages, never less than one.
 */
export const pageCountOf = (count: number, rowsPerPage: number): number => {
	return Math.max(FIRST_PAGE, Math.ceil(count / rowsPerPage));
};

/**
 * Takes one page out of an ordered list.
 * @param rows The rows, in the order they are shown.
 * @param page The page, counting from one.
 * @param rowsPerPage How many rows a page holds.
 * @returns The rows on that page.
 */
export const pageOf = <TRow>(rows: readonly TRow[], page: number, rowsPerPage: number): TRow[] => {
	const start = (page - FIRST_PAGE) * rowsPerPage;

	return rows.slice(start, start + rowsPerPage);
};

/**
 * Which page a row sits on, which is how a screen follows a row it has just written.
 * @param rows The rows, in the order they are shown.
 * @param matches What identifies the row being followed.
 * @param rowsPerPage How many rows a page holds.
 * @returns The page holding it, or the first page when the list does not hold it.
 */
export const pageHolding = <TRow>(rows: readonly TRow[], matches: (row: TRow) => boolean, rowsPerPage: number): number => {
	const position = rows.findIndex(matches);

	if(position < 0) {
		return FIRST_PAGE;
	}

	return Math.floor(position / rowsPerPage) + FIRST_PAGE;
};
