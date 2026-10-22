// /lists?status=open|completed|archived: the user's shopping lists by status.
import { supabase } from './supabase.js';
import { requireUser } from './auth.js';
import { loadTopbar } from './topbar.js';
import {
  STATUS_ACTIONS, DELETE_ACTION, setListStatus, deleteList, formatDate, autoDeleteDate,
} from './list-actions.js';

const VIEWS = {
  open: { title: 'Open lists', empty: 'You have no open lists.' },
  completed: { title: 'Completed lists', empty: 'You have no completed lists.' },
  archived: { title: 'Archived lists', empty: 'You have no archived lists.' },
};

const requested = new URLSearchParams(window.location.search).get('status');
const status = VIEWS[requested] ? requested : 'open';

const listEl = document.getElementById('lists');
const emptyEl = document.getElementById('lists-empty');
const message = document.getElementById('lists-message');

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('form-message--error', isError);
}

function createActionButton(action, value) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--ghost btn--small';
  button.dataset.action = value;
  button.textContent = action.label;
  return button;
}

function createListCard(list, retentionDays) {
  const card = document.createElement('li');
  card.className = 'list-card';
  card.dataset.id = list.id;

  const info = document.createElement('div');
  info.className = 'list-card__info';
  const name = document.createElement('a');
  name.className = 'list-card__name';
  name.href = `/list?id=${list.id}`;
  name.textContent = list.supermarkets?.name ?? 'Unknown supermarket';
  const itemCount = list.shopping_list_items?.[0]?.count ?? 0;
  const meta = document.createElement('span');
  meta.className = 'list-card__date';
  meta.textContent = `${formatDate(list.shop_date)} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  info.append(name, meta);

  const deletesOn = list.status === 'archived' && autoDeleteDate(list.archived_at, retentionDays);
  if (deletesOn) {
    const note = document.createElement('span');
    note.className = 'list-card__note';
    note.textContent = `Deletes automatically on ${deletesOn}`;
    info.append(note);
  }
  card.append(info);

  const actions = document.createElement('div');
  actions.className = 'list-card__actions';
  if (list.status === 'open') {
    for (const [value, action] of Object.entries(STATUS_ACTIONS)) actions.append(createActionButton(action, value));
  } else {
    actions.append(createActionButton(DELETE_ACTION, 'delete'));
  }
  card.append(actions);

  return card;
}

function updateEmptyState() {
  emptyEl.hidden = listEl.children.length > 0;
}

const user = await requireUser();

if (user) {
  document.title = `${VIEWS[status].title} – ShopSprite 365`;
  document.getElementById('lists-title').textContent = VIEWS[status].title;
  document.getElementById('lists-empty-text').textContent = VIEWS[status].empty;
  document.getElementById('lists-new-link').hidden = status !== 'open';

  const [, { data: lists, error }, { data: settings }] = await Promise.all([
    loadTopbar(user),
    supabase
      .from('shopping_lists')
      .select('id, shop_date, status, archived_at, supermarkets(name), shopping_list_items(count)')
      .eq('status', status)
      .order('shop_date', { ascending: status === 'open' }),
    supabase.from('profiles').select('archive_retention_days').eq('id', user.id).maybeSingle(),
  ]);

  if (error) {
    showMessage(`Could not load lists: ${error.message}`, true);
  } else {
    listEl.append(...lists.map((list) => createListCard(list, settings?.archive_retention_days)));
    updateEmptyState();
  }

  document.getElementById('main').hidden = false;

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const isDelete = button.dataset.action === 'delete';
    const action = isDelete ? DELETE_ACTION : STATUS_ACTIONS[button.dataset.action];
    if (!window.confirm(action.confirm)) return;

    const card = button.closest('.list-card');
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    showMessage('');

    const error = isDelete
      ? await deleteList(card.dataset.id)
      : await setListStatus(card.dataset.id, button.dataset.action);

    if (error) {
      showMessage(`Could not update list: ${error.message}`, true);
      card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    } else {
      card.remove();
      updateEmptyState();
      showMessage(action.done);
    }
  });
}
