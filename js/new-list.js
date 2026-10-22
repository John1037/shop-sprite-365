// /new-list: create a shopping list.
import { supabase } from './supabase.js';
import { requireUser } from './auth.js';
import { loadTopbar } from './topbar.js';
import { SUPERMARKET_SLOTS } from './supermarkets.js';

const form = document.getElementById('new-list-form');
const locationSelect = form.elements.supermarket_id;
const dateInput = form.elements.shop_date;
const submitBtn = document.getElementById('new-list-submit');
const message = document.getElementById('new-list-message');

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('form-message--error', isError);
}

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const user = await requireUser();

if (user) {
  const [, { data: prefs }, { data: markets, error: marketsError }] = await Promise.all([
    loadTopbar(user),
    supabase.from('profiles').select(SUPERMARKET_SLOTS.join(', ')).eq('id', user.id).maybeSingle(),
    supabase.from('supermarkets').select('id, name, is_active').order('name'),
  ]);

  if (marketsError) {
    showMessage(`Could not load supermarkets: ${marketsError.message}`, true);
    submitBtn.disabled = true;
  } else {
    // Preferred supermarkets first, in order; the top preference is pre-selected.
    const byId = new Map(markets.map((m) => [m.id, m]));
    const preferred = SUPERMARKET_SLOTS.map((slot) => byId.get(prefs?.[slot])).filter(Boolean);
    const others = markets.filter((m) => m.is_active && !preferred.includes(m));
    const toOption = (m) => new Option(m.name, m.id);

    if (preferred.length) {
      const preferredGroup = document.createElement('optgroup');
      preferredGroup.label = 'Your supermarkets';
      preferredGroup.append(...preferred.map(toOption));
      const otherGroup = document.createElement('optgroup');
      otherGroup.label = 'Other supermarkets';
      otherGroup.append(...others.map(toOption));
      locationSelect.append(preferredGroup, otherGroup);
      locationSelect.value = preferred[0].id;
    } else {
      locationSelect.append(new Option('Choose a supermarket…', ''), ...others.map(toOption));
      document.getElementById('prefs-tip').hidden = false;
    }
  }

  dateInput.value = todayIso();
  dateInput.min = todayIso();

  document.getElementById('main').hidden = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    showMessage('');

    const { error } = await supabase.from('shopping_lists').insert({
      supermarket_id: locationSelect.value,
      shop_date: dateInput.value,
    });

    if (error) {
      showMessage(`Could not create list: ${error.message}`, true);
      submitBtn.disabled = false;
    } else {
      window.location.assign('/lists?status=open');
    }
  });
}
