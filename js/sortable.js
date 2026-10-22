// Drag-to-reorder for a list: mouse, touch, and arrow keys on the handle.

export const GRIP_ICON = '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></g></svg>';

// Items are the list's direct children, each with a data-id and a .drag-handle.
// onReorder(ids) is called with the new order after each drop or key press.
export function makeSortable(listEl, onReorder) {
  const ids = () => [...listEl.children].map((li) => li.dataset.id);
  let dragItem = null;
  let startOrder = '';

  // Movement is tracked on the document because moving the item in the DOM
  // would drop pointer capture.
  function onDragMove(event) {
    const next = [...listEl.children].find((li) => {
      if (li === dragItem) return false;
      const box = li.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    if (next !== dragItem.nextElementSibling) listEl.insertBefore(dragItem, next ?? null);
  }

  function onDragEnd() {
    dragItem.classList.remove('is-dragging');
    dragItem = null;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);
    if (ids().join() !== startOrder) onReorder(ids());
  }

  listEl.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.drag-handle');
    if (!handle || dragItem) return;
    event.preventDefault();
    dragItem = handle.closest('[data-id]');
    dragItem.classList.add('is-dragging');
    startOrder = ids().join();
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  });

  listEl.addEventListener('keydown', (event) => {
    const handle = event.target.closest('.drag-handle');
    if (!handle || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const item = handle.closest('[data-id]');
    const sibling = event.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    listEl.insertBefore(item, event.key === 'ArrowUp' ? sibling : sibling.nextElementSibling);
    handle.focus();
    onReorder(ids());
  });
}

export function createDragHandle(label) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'drag-handle';
  handle.setAttribute('aria-label', `Move ${label} (use arrow keys)`);
  handle.innerHTML = GRIP_ICON;
  return handle;
}
