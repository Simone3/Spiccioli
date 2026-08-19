import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type Announcements,
	type DragEndEvent,
	type ScreenReaderInstructions,
	type UniqueIdentifier
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactElement, ReactNode } from 'react';
import { Chip } from 'src/components/common/Chip';
import { RowMenu } from 'src/components/common/RowMenu';
import { useFormatter } from 'src/contexts/PreferencesContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { LedgerId, Rule } from 'src/types/LedgerTypes';

/**
 * The rule list: ordered, draggable, numbered.
 *
 * **First match wins, so the order is the logic and is visible.** The number in the second column is the position and nothing
 * stored: the array is the order, and dragging a row is what changes it.
 *
 * **The drag handle is a real button** — which is the condition the drag library was chosen on — so the keyboard reaches it,
 * picks a rule up with Space and moves it with the arrows, and **what the drag announces comes out of the translation bundle**
 * like every other word the user can read.
 *
 * **This is not the one table of the kit**, because a row here carries the drag sensor's own attributes and a ref on the `tr`
 * itself, which a table that renders its own rows cannot hand out. It wears the same classes, so it reads as the same table.
 */

// What a row says about itself while the draft holds it and the file does not
export type RuleDraftMarker = 'added' | 'edited';

export interface RulesTableProps {

	// The draft, in its own order
	rules: readonly Rule[];

	// The name each rule's category has, by category id
	categoryNames: ReadonlyMap<LedgerId, string>;

	// How many transactions each rule accounts for **in the file**, which is the applied list and never the draft
	applications: ReadonlyMap<LedgerId, number>;

	// What each rule is doing that the file does not know about yet
	markers: ReadonlyMap<LedgerId, RuleDraftMarker>;

	// Whether anything is pending, which is what dims the counts and labels them as being about the applied list
	isDraftPending: boolean;

	footer: ReactNode;

	onMove: (fromIndex: number, toIndex: number) => void;
	onEdit: (rule: Rule) => void;
	onDelete: (rule: Rule) => void;
}

interface SortableRuleRowProps {
	rule: Rule;
	position: number;
	categoryName: string | undefined;
	applications: number | undefined;
	marker: RuleDraftMarker | undefined;
	isDraftPending: boolean;
	onEdit: (rule: Rule) => void;
	onDelete: (rule: Rule) => void;
}

/**
 * One rule, where it currently sits.
 * @param props The row's props.
 * @param props.rule The rule.
 * @param props.position Where it is in the list, counting from one.
 * @param props.categoryName What it assigns.
 * @param props.applications How many transactions it accounts for in the file.
 * @param props.marker What it is doing that the file does not know about yet.
 * @param props.isDraftPending Whether anything is pending.
 * @param props.onEdit What correcting it does.
 * @param props.onDelete What removing it from the draft does.
 * @returns The row.
 */
const SortableRuleRow = ({
	rule,
	position,
	categoryName,
	applications,
	marker,
	isDraftPending,
	onEdit,
	onDelete
}: SortableRuleRowProps): ReactElement => {
	const { t } = useTranslator();
	const formatter = useFormatter();
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });

	return (
		<tr
			ref={setNodeRef}
			className={isDragging ? 'categories-screen-rule-dragging' : undefined}
			style={{
				transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
				transition
			}}>
			<td>
				<button
					type='button'
					className='categories-screen-handle'
					aria-label={t('rules.reorder', { rule: rule.substring })}
					{...attributes}
					{...listeners}>
					⣿
				</button>
			</td>
			<td className='data-table-numeric categories-screen-rule-number'>{formatter.integer(position)}</td>
			<td>
				{rule.substring}
				{marker && <span className='categories-screen-marker'><Chip tone='accent'>{t(`rules.marker.${marker}`)}</Chip></span>}
			</td>
			<td>{categoryName && <Chip tone='provenance'>{categoryName}</Chip>}</td>
			<td className={`data-table-numeric${isDraftPending ? ' categories-screen-stale' : ''}`}>
				{applications === undefined ? t('table.notApplicable') : formatter.integer(applications)}
			</td>
			<td>
				<RowMenu
					label={t('rules.rowMenu', { rule: rule.substring })}
					actions={[
						{
							key: 'edit',
							label: t('rowMenu.edit'),
							onSelect: () => {
								onEdit(rule);
							}
						},
						{
							key: 'delete',
							label: t('rowMenu.delete'),
							danger: true,
							onSelect: () => {
								onDelete(rule);
							}
						}
					]}/>
			</td>
		</tr>
	);
};

/**
 * The rule list.
 * @param props The table's props.
 * @param props.rules The draft, in its own order.
 * @param props.categoryNames What each category is called.
 * @param props.applications What each rule accounts for in the file.
 * @param props.markers What each rule is doing that the file does not know about yet.
 * @param props.isDraftPending Whether anything is pending.
 * @param props.footer What goes under the rule.
 * @param props.onMove What dragging or keying a rule to another position does.
 * @param props.onEdit What correcting one does.
 * @param props.onDelete What removing one does.
 * @returns The table.
 */
export const RulesTable = ({
	rules,
	categoryNames,
	applications,
	markers,
	isDraftPending,
	footer,
	onMove,
	onEdit,
	onDelete
}: RulesTableProps): ReactElement => {
	const { t } = useTranslator();

	// The pointer needs a little travel before it counts as a drag, so that clicking the handle is not one
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const indexOf = (id: UniqueIdentifier | undefined): number => {
		return rules.findIndex((rule) => {
			return rule.id === id;
		});
	};

	const describe = (id: UniqueIdentifier | undefined): string => {
		return rules[indexOf(id)]?.substring ?? '';
	};

	const positionOf = (id: UniqueIdentifier | undefined): number => {
		return indexOf(id) + 1;
	};

	// Everything the drag says out loud, in the bundle like every other word: the library's own wording is English in the code
	const announcements: Announcements = {
		onDragStart: ({ active }) => {
			return t('rules.drag.picked', { rule: describe(active.id), position: positionOf(active.id), of: rules.length });
		},
		onDragOver: ({ active, over }) => {
			return over ? t('rules.drag.over', { rule: describe(active.id), position: positionOf(over.id), of: rules.length }) : undefined;
		},
		onDragEnd: ({ active, over }) => {
			return over ?
				t('rules.drag.dropped', { rule: describe(active.id), position: positionOf(over.id), of: rules.length }) :
				t('rules.drag.cancelled', { rule: describe(active.id) });
		},
		onDragCancel: ({ active }) => {
			return t('rules.drag.cancelled', { rule: describe(active.id) });
		}
	};

	const screenReaderInstructions: ScreenReaderInstructions = { draggable: t('rules.drag.instructions') };

	const move = (event: DragEndEvent): void => {
		const from = indexOf(event.active.id);
		const to = indexOf(event.over?.id);

		if(from >= 0 && to >= 0 && from !== to) {
			onMove(from, to);
		}
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			accessibility={{ announcements, screenReaderInstructions }}
			onDragEnd={move}>
			<div className='data-table-scroll'>
				<table className='data-table categories-screen-rules' aria-label={t('rules.table')}>
					<thead>
						<tr>
							<th scope='col'><span className='categories-screen-handle-header'>{t('rules.columns.order')}</span></th>
							<th scope='col' className='data-table-numeric'>{t('rules.columns.position')}</th>
							<th scope='col'>{t('rules.columns.substring')}</th>
							<th scope='col'>{t('rules.columns.category')}</th>
							<th scope='col' className='data-table-numeric'>{t('rules.columns.appliesTo')}</th>
							<th scope='col'/>
						</tr>
					</thead>
					<tbody>
						<SortableContext
							items={rules.map((rule) => {
								return rule.id;
							})}
							strategy={verticalListSortingStrategy}>
							{rules.map((rule, index) => {
								return (
									<SortableRuleRow
										key={rule.id}
										rule={rule}
										position={index + 1}
										categoryName={categoryNames.get(rule.categoryId)}
										applications={applications.get(rule.id)}
										marker={markers.get(rule.id)}
										isDraftPending={isDraftPending}
										onEdit={onEdit}
										onDelete={onDelete}/>
								);
							})}
						</SortableContext>
					</tbody>
					<tfoot>
						<tr>
							<td colSpan={6}>{footer}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</DndContext>
	);
};
