// /list?id=...: a single shopping list and its items.
import { supabase } from './supabase.js';
import { requireUser } from './auth.js';
import { loadTopbar } from './topbar.js';
import { makeSortable, createDragHandle } from './sortable.js';
import {
  STATUS_LABELS, STATUS_ACTIONS, DELETE_ACTION, setListStatus, deleteList, formatDate, autoDeleteDate,
} from './list-actions.js';

const listId = new URLSearchParams(window.location.search).get('id');

const titleEl = document.getElementById('list-title');
const metaEl = document.getElementById('list-meta');
const actionsEl = document.getElementById('list-actions');
const message = document.getElementById('list-message');
const addForm = document.getElementById('add-item-form');
const itemsEl = document.getElementById('items');
const itemsEmpty = document.getElementById('items-empty');
const itemsSummary = document.getElementById('items-summary');

let list = null;
let items = [];
let retentionDays = null;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('form-message--error', isError);
}

const isOpen = () => list.status === 'open';

function formatQuantity(item) {
  if (item.quantity == null) return item.unit ?? '';
  return item.unit ? `${item.quantity} ${item.unit}` : `× ${item.quantity}`;
}

function renderHeader() {
  titleEl.textContent = list.supermarkets?.name ?? 'Unknown supermarket';
  document.title = `${titleEl.textContent} list – ShopSprite 365`;

  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${list.status}`;
  badge.textContent = STATUS_LABELS[list.status];
  metaEl.replaceChildren(`${formatDate(list.shop_date)} `, badge);

  const deletesOn = list.status === 'archived' && autoDeleteDate(list.archived_at, retentionDays);
  if (deletesOn) metaEl.append(` · Deletes automatically on ${deletesOn}`);

  const buttons = isOpen() ? Object.entries(STATUS_ACTIONS) : [['delete', DELETE_ACTION]];
  actionsEl.replaceChildren(...buttons.map(([value, action]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--ghost btn--small';
    button.dataset.action = value;
    button.textContent = action.label;
    return button;
  }));

  addForm.hidden = !isOpen();
}

function createItemRow(item) {
  const row = document.createElement('li');
  row.className = 'item-row';
  row.classList.toggle('item-row--checked', item.is_checked);
  row.dataset.id = item.id;

  if (isOpen()) row.append(createDragHandle(item.name));

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'item-row__check';
  check.checked = item.is_checked;
  check.disabled = !isOpen();
  check.setAttribute('aria-label', `Got ${item.name}`);

  const name = document.createElement('span');
  name.className = 'item-row__name';
  name.textContent = item.name;

  const qty = document.createElement('span');
  qty.className = 'item-row__qty';
  qty.textContent = formatQuantity(item);

  row.append(check, name, qty);

  if (isOpen()) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'item-row__remove';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.textContent = '×';
    row.append(remove);
  }

  return row;
}

function renderSummary() {
  const checked = items.filter((i) => i.is_checked).length;
  itemsSummary.hidden = items.length === 0;
  itemsSummary.textContent = `${checked} of ${items.length} ticked off`;
}

function renderItems() {
  itemsEl.replaceChildren(...items.map(createItemRow));
  itemsEmpty.hidden = items.length > 0;
  renderSummary();
}

const user = await requireUser();

if (user) {
  const [, { data, error }, { data: itemData }, { data: settings }] = await Promise.all([
    loadTopbar(user),
    supabase
      .from('shopping_lists')
      .select('id, shop_date, status, archived_at, supermarkets(name)')
      .eq('id', listId)
      .maybeSingle(),
    supabase
      .from('shopping_list_items')
      .select('id, name, quantity, unit, position, is_checked')
      .eq('list_id', listId)
      .order('position')
      .order('created_at'),
    supabase.from('profiles').select('archive_retention_days').eq('id', user.id).maybeSingle(),
  ]);

  document.getElementById('main').hidden = false;

  // RLS hides other users' lists, so "not found" covers those too.
  if (error || !data) {
    titleEl.textContent = 'List not found';
    showMessage('This list doesn\'t exist or has been deleted.', true);
  } else {
    list = data;
    items = itemData ?? [];
    retentionDays = settings?.archive_retention_days;
    document.getElementById('list-body').hidden = false;
    renderHeader();
    renderItems();

    actionsEl.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const isDelete = button.dataset.action === 'delete';
      const action = isDelete ? DELETE_ACTION : STATUS_ACTIONS[button.dataset.action];
      if (!window.confirm(action.confirm)) return;

      actionsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      showMessage('');

      if (isDelete) {
        const deleteError = await deleteList(list.id);
        if (!deleteError) {
          window.location.assign(`/lists?status=${list.status}`);
          return;
        }
        showMessage(`Could not delete list: ${deleteError.message}`, true);
      } else {
        const statusError = await setListStatus(list.id, button.dataset.action);
        if (!statusError) {
          list.status = button.dataset.action;
          if (list.status === 'archived') list.archived_at = new Date().toISOString();
          renderHeader();
          renderItems();
          showMessage(action.done);
          return;
        }
        showMessage(`Could not update list: ${statusError.message}`, true);
      }
      actionsEl.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    });

    addForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = addForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      showMessage('');

      const quantity = addForm.elements.quantity.value;
      const { data: item, error: addError } = await supabase
        .from('shopping_list_items')
        .insert({
          list_id: list.id,
          name: addForm.elements.name.value.trim(),
          quantity: quantity ? Number(quantity) : null,
          unit: addForm.elements.unit.value.trim() || null,
          position: items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0,
        })
        .select('id, name, quantity, unit, position, is_checked')
        .single();

      if (addError) {
        showMessage(`Could not add item: ${addError.message}`, true);
      } else {
        items.push(item);
        renderItems();
        addForm.reset();
        addForm.elements.name.focus();
      }
      submit.disabled = false;
    });

    itemsEl.addEventListener('change', async (event) => {
      if (!event.target.matches('.item-row__check')) return;
      const row = event.target.closest('.item-row');
      const item = items.find((i) => i.id === row.dataset.id);
      const checked = event.target.checked;

      const { error: checkError } = await supabase
        .from('shopping_list_items')
        .update({ is_checked: checked })
        .eq('id', item.id);

      if (checkError) {
        event.target.checked = !checked;
        showMessage(`Could not update item: ${checkError.message}`, true);
      } else {
        item.is_checked = checked;
        row.classList.toggle('item-row--checked', checked);
        renderSummary();
      }
    });

    itemsEl.addEventListener('click', async (event) => {
      const remove = event.target.closest('.item-row__remove');
      if (!remove) return;
      const id = remove.closest('.item-row').dataset.id;
      remove.disabled = true;

      const { error: removeError } = await supabase.from('shopping_list_items').delete().eq('id', id);
      if (removeError) {
        remove.disabled = false;
        showMessage(`Could not remove item: ${removeError.message}`, true);
      } else {
        items = items.filter((i) => i.id !== id);
        renderItems();
      }
    });

    // Save only the positions that changed.
    makeSortable(itemsEl, async (ids) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      items = ids.map((id) => byId.get(id));
      const changed = items.filter((item, index) => item.position !== index);
      changed.forEach((item) => { item.position = items.indexOf(item); });

      const results = await Promise.all(changed.map((item) => supabase
        .from('shopping_list_items')
        .update({ position: item.position })
        .eq('id', item.id)));

      const failed = results.find((r) => r.error);
      if (failed) showMessage(`Could not save the new order: ${failed.error.message}`, true);
    });
  }
}
