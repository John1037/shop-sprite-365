// /lists?status=open|completed|archived: the user's shopping lists by status.
import { supabase } from './supabase.js';
import { requireUser } from './auth.js';
import { loadTopbar } from './topbar.js';

const VIEWS = {
  open: { title: 'Open lists', empty: 'You have no open lists.' },
  completed: { title: 'Completed lists', empty: 'You have no completed lists.' },
  archived: { title: 'Archived lists', empty: 'You have no archived lists.' },
};

const ACTIONS = {
  completed: { label: 'Mark completed', confirm: 'Mark this list as completed? This can\'t be undone.', done: 'List marked as completed.' },
  archived: { label: 'Archive', confirm: 'Archive this list? This can\'t be undone.', done: 'List archived.' },
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

// shop_date is a plain date; build it in local time so it never shifts a day.
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function createListCard(list) {
  const card = document.createElement('li');
  card.className = 'list-card';
  card.dataset.id = list.id;

  const info = document.createElement('div');
  info.className = 'list-card__info';
  const name = document.createElement('span');
  name.className = 'list-card__name';
  name.textContent = list.supermarkets?.name ?? 'Unknown supermarket';
  const date = document.createElement('span');
  date.className = 'list-card__date';
  date.textContent = formatDate(list.shop_date);
  info.append(name, date);
  card.append(info);

  if (list.status === 'open') {
    const actions = document.createElement('div');
    actions.className = 'list-card__actions';
    for (const [newStatus, action] of Object.entries(ACTIONS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--ghost btn--small';
      button.dataset.status = newStatus;
      button.textContent = action.label;
      actions.append(button);
    }
    card.append(actions);
  }

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

  const [, { data: lists, error }] = await Promise.all([
    loadTopbar(user),
    supabase
      .from('shopping_lists')
      .select('id, shop_date, status, supermarkets(name)')
      .eq('status', status)
      .order('shop_date', { ascending: status === 'open' }),
  ]);

  if (error) {
    showMessage(`Could not load lists: ${error.message}`, true);
  } else {
    listEl.append(...lists.map(createListCard));
    updateEmptyState();
  }

  document.getElementById('main').hidden = false;

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-status]');
    if (!button) return;
    const action = ACTIONS[button.dataset.status];
    if (!window.confirm(action.confirm)) return;

    const card = button.closest('.list-card');
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    showMessage('');

    const { error } = await supabase
      .from('shopping_lists')
      .update({ status: button.dataset.status })
      .eq('id', card.dataset.id);

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
