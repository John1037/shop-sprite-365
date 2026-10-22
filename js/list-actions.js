// Shared shopping list helpers: status changes, deletion, and date display.
import { supabase } from './supabase.js';

export const STATUS_LABELS = { open: 'Open', completed: 'Completed', archived: 'Archived' };

// Open lists can move to either of these; the change is one way.
export const STATUS_ACTIONS = {
  completed: { label: 'Mark completed', confirm: 'Mark this list as completed? This can\'t be undone.', done: 'List marked as completed.' },
  archived: { label: 'Archive', confirm: 'Archive this list? This can\'t be undone.', done: 'List archived.' },
};

export const DELETE_ACTION = {
  label: 'Delete',
  confirm: 'Delete this list and all its items? This can\'t be undone.',
  done: 'List deleted.',
};

export async function setListStatus(id, status) {
  const { error } = await supabase.from('shopping_lists').update({ status }).eq('id', id);
  return error;
}

export async function deleteList(id) {
  const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
  return error;
}

// shop_date is a plain date; build it in local time so it never shifts a day.
export function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// When the nightly clean-up will delete an archived list, or null if never.
export function autoDeleteDate(archivedAt, retentionDays) {
  if (!archivedAt || !retentionDays) return null;
  const date = new Date(archivedAt);
  date.setDate(date.getDate() + retentionDays + 1);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
