export interface ManuallySortedItem {
	sortPosition: number;
}

type CloneManuallySortedItem<TElement> = (element: TElement) => TElement;

// "sortPositionStep" is the gap left between two adjacent sort positions, so that later insertions usually fit without renumbering anything
export interface ManuallySortedListOptions<TElement> {
	sortPositionStep: number;

	// Called before an item's sort position changes, for callers that must not mutate the items they were given
	cloneElement?: CloneManuallySortedItem<TElement>;
}

const setSortPosition = <TElement extends ManuallySortedItem>(list: TElement[], index: number, sortPosition: number, cloneElement?: CloneManuallySortedItem<TElement>): void => {
	const element = cloneElement ? cloneElement(list[index]) : list[index];
	element.sortPosition = sortPosition;
	list[index] = element;
};

/**
 * Computes sortPosition fields for elements starting from unsortedStartIndex until a suitable sortPosition is found or the end of the list is reached.
 * I.e. fixes an "unsorted section" in the list until it is closed.
 * referenceSortPosition is the element BEFORE the "unsorted section" (i.e. the reference sortPosition for the min value).
 * unsortedStartIndex is the element that starts the "unsorted section".
 * The function finds the element at index X >= unsortedStartIndex + 1 that has a sortPosition bigger than referenceSortPosition and is able to fit all
 * elements between them.
 * @param list Sorted list to repair.
 * @param referenceSortPosition Sort position before the unsorted section.
 * @param unsortedStartIndex First unsorted item index.
 * @param options Sort position step and optional item clone callback.
 * @returns The next index to inspect.
 */
const fixSortPositionsInUnsortedSection = <TElement extends ManuallySortedItem>(list: TElement[], referenceSortPosition: number, unsortedStartIndex: number, options: ManuallySortedListOptions<TElement>): number => {
	let i = unsortedStartIndex + 1;
	let unsortedCount = 1;
	while(i < list.length) {
		if(list[i].sortPosition - referenceSortPosition - 1 >= unsortedCount) {
			// We found an element high enough to close the "unsorted section"
			// Recompute sort positions for all elements in between with proportionally distributed sortPosition between referenceSortPosition and the found sortPosition
			const sortFixStep = (list[i].sortPosition - referenceSortPosition - 1) / (unsortedCount + 1);
			for(let j = 0; j < unsortedCount; j++) {
				setSortPosition(list, unsortedStartIndex + j, referenceSortPosition + Math.ceil((j + 1) * sortFixStep), options.cloneElement);
			}
			return i + 1;
		}
		else {
			// The current element does not allow to close the "unsorted section": count and go on
			unsortedCount += 1;
			i += 1;
		}
	}

	// We reached the end of the list without closing the "unsorted section": reload all trailing elements with the default step
	for(let j = unsortedStartIndex; j < list.length; j++) {
		setSortPosition(list, j, list[j - 1].sortPosition + options.sortPositionStep, options.cloneElement);
	}
	return i;
};

/**
 * Inserts an item at position "index" (shifting all following elements, the current "index" element included).
 * It also sets the "sortPosition" field in the new element.
 * It may recompute the "sortPosition" fields of other elements if space needs to be made.
 * @param list List receiving the item.
 * @param element Item to insert.
 * @param index Destination index.
 * @param options Sort position step and optional item clone callback.
 * @returns The updated list.
 */
export const insertIntoManuallySortedList = <TElement extends ManuallySortedItem>(list: TElement[], element: TElement, index: number, options: ManuallySortedListOptions<TElement>): TElement[] => {
	if(!Array.isArray(list)) {
		throw Error('List is not an array');
	}

	// Empty list: start with position 0
	if(list.length === 0) {
		list.push(element);
		setSortPosition(list, 0, 0, options.cloneElement);
		return list;
	}

	// Add at the start of the list: position is the current first element minus the step
	if(index <= 0) {
		list.unshift(element);
		setSortPosition(list, 0, list[1].sortPosition - options.sortPositionStep, options.cloneElement);
		return list;
	}

	// Add at the end of the list: position is the current last element plus the step
	if(index >= list.length) {
		list.push(element);
		setSortPosition(list, list.length - 1, list[list.length - 2].sortPosition + options.sortPositionStep, options.cloneElement);
		return list;
	}

	// Add in the middle of the list and then compute sortPosition to fit adjacent elements (possibly changing sortPosition of following elements if there's no space to fit the new one)
	list.splice(index, 0, element);
	fixSortPositionsInUnsortedSection(list, list[index - 1].sortPosition, index, options);
	return list;
};

/**
 * Moves the item at position "fromIndex" to position "toIndex" (i.e. it will be placed in the position BEFORE the current "toIndex" element).
 * It also updates the "sortPosition" field in the moved element.
 * It may recompute the "sortPosition" fields of other elements if space needs to be made.
 * @param list List containing the item.
 * @param fromIndex Current item index.
 * @param toIndex Destination item index.
 * @param options Sort position step and optional item clone callback.
 * @returns The updated list.
 */
export const moveInManuallySortedList = <TElement extends ManuallySortedItem>(list: TElement[], fromIndex: number, toIndex: number, options: ManuallySortedListOptions<TElement>): TElement[] => {
	if(!Array.isArray(list)) {
		throw Error('List is not an array');
	}

	if(fromIndex < 0 || fromIndex >= list.length) {
		throw Error('FromIndex out of bound');
	}

	if(fromIndex === toIndex) {
		return list;
	}

	// Remove the element and re-add it at the requested index (this can probably be implemented more efficiently but enough for now...)
	const [ element ] = list.splice(fromIndex, 1);
	insertIntoManuallySortedList(list, element, toIndex, options);
	return list;
};

/**
 * Given a SORTED list, recomputes the "sortPosition" fields whenever necessary (i.e. where items are out of order with non-ascending "sortPosition" fields)
 * @param list Sorted list to repair.
 * @param options Sort position step and optional item clone callback.
 * @returns The updated list.
 */
export const recomputeSortPositions = <TElement extends ManuallySortedItem>(list: TElement[], options: ManuallySortedListOptions<TElement>): TElement[] => {
	if(list.length <= 1) {
		return list;
	}

	let i = 1;
	while(i < list.length) {
		if(list[i - 1].sortPosition >= list[i].sortPosition) {
			// Current element is unsorted, call the utility to close this "unsorted section" (possibly spanning more than one element)
			i = fixSortPositionsInUnsortedSection(list, list[i - 1].sortPosition, i, options);
		}
		else {
			// All good with current sorting, move on
			i += 1;
		}
	}

	return list;
};
