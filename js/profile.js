// /profile: view and edit the signed-in user's profile.
import { supabase } from './supabase.js';
import { requireUser } from './auth.js';
import { getAvatarUrl, uploadAvatar, removeAvatar, renderAvatar } from './avatar.js';
import { createCropper } from './cropper.js';
import { initTopbar, setMenuAvatar } from './topbar.js';
import { MAX_SUPERMARKETS, SUPERMARKET_SLOTS } from './supermarkets.js';
import { makeSortable, createDragHandle } from './sortable.js';

const FIELDS = ['full_name', 'display_name', 'phone', 'postcode'];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const form = document.getElementById('profile-form');
const submitBtn = document.getElementById('profile-submit');
const message = document.getElementById('profile-message');

const avatarEl = document.getElementById('profile-avatar');
const avatarInput = document.getElementById('avatar-input');
const avatarRemoveBtn = document.getElementById('avatar-remove');
const avatarMessage = document.getElementById('avatar-message');

const cropDialog = document.getElementById('crop-dialog');
const cropSaveBtn = document.getElementById('crop-save');
const cropMessage = document.getElementById('crop-message');
const cropper = createCropper(document.getElementById('crop-canvas'), document.getElementById('crop-zoom'));

function showMessage(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle('form-message--error', isError);
}

const user = await requireUser();

if (user) {
  form.elements.email.value = user.email;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select([...FIELDS, ...SUPERMARKET_SLOTS, 'archive_retention_days', 'avatar_path'].join(', '))
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    showMessage(message, `Could not load profile: ${error.message}`, true);
  } else if (profile) {
    for (const field of FIELDS) form.elements[field].value = profile[field] ?? '';
  }

  // Null means archived lists are kept forever; new profiles default to 90 days.
  const retentionSelect = form.elements.archive_retention_days;
  retentionSelect.value = profile ? String(profile.archive_retention_days ?? 'never') : '90';

  let avatarPath = profile?.avatar_path ?? null;
  let avatarUrl = await getAvatarUrl(avatarPath);
  let objectUrl = null;

  const displayName = () => form.elements.display_name.value.trim() || user.email;

  function renderAvatars() {
    renderAvatar(avatarEl, avatarUrl, displayName());
    setMenuAvatar(avatarUrl, displayName());
    avatarRemoveBtn.hidden = !avatarPath;
  }

  initTopbar(avatarUrl, displayName());
  renderAvatars();

  // Preferred supermarkets, in order of preference (slot 1 first).
  const marketList = document.getElementById('market-list');
  const marketHint = document.getElementById('market-hint');
  const marketAdd = document.getElementById('market-add');

  const { data: markets, error: marketsError } = await supabase
    .from('supermarkets')
    .select('id, name, is_active')
    .order('name');

  const marketById = new Map((markets ?? []).map((m) => [m.id, m]));
  const selectedMarkets = SUPERMARKET_SLOTS.map((slot) => profile?.[slot]).filter((id) => marketById.has(id));

  function createMarketItem(id, index) {
    const { name } = marketById.get(id);
    const item = document.createElement('li');
    item.className = 'market-item';
    item.dataset.id = id;

    const handle = createDragHandle(name);

    const rank = document.createElement('span');
    rank.className = 'market-item__rank';
    rank.textContent = index + 1;

    const label = document.createElement('span');
    label.className = 'market-item__name';
    label.textContent = name;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'market-item__remove';
    remove.setAttribute('aria-label', `Remove ${name}`);
    remove.textContent = '×';

    item.append(handle, rank, label, remove);
    return item;
  }

  function renderMarkets() {
    marketList.replaceChildren(...selectedMarkets.map(createMarketItem));
    marketList.hidden = selectedMarkets.length === 0;

    const full = selectedMarkets.length >= MAX_SUPERMARKETS;
    marketHint.hidden = selectedMarkets.length === 0;
    marketHint.textContent = full
      ? `Maximum of ${MAX_SUPERMARKETS} reached. Drag to reorder, or remove one to add another.`
      : 'Drag to reorder. Your top choice is number 1.';

    // Retired supermarkets can stay selected but can't be newly added.
    const available = (markets ?? []).filter((m) => m.is_active && !selectedMarkets.includes(m.id));
    const placeholder = new Option(selectedMarkets.length ? 'Add another supermarket…' : 'Add a supermarket…', '');
    marketAdd.replaceChildren(placeholder, ...available.map((m) => new Option(m.name, m.id)));
    marketAdd.hidden = full || available.length === 0;
  }

  if (marketsError) {
    marketAdd.hidden = true;
    marketHint.hidden = false;
    showMessage(marketHint, `Could not load supermarkets: ${marketsError.message}`, true);
  } else {
    marketAdd.addEventListener('change', () => {
      if (!marketAdd.value) return;
      selectedMarkets.push(marketAdd.value);
      renderMarkets();
      if (!marketAdd.hidden) marketAdd.focus();
    });

    marketList.addEventListener('click', (event) => {
      const remove = event.target.closest('.market-item__remove');
      if (!remove) return;
      selectedMarkets.splice(selectedMarkets.indexOf(remove.closest('.market-item').dataset.id), 1);
      renderMarkets();
    });

    makeSortable(marketList, (ids) => {
      selectedMarkets.splice(0, selectedMarkets.length, ...ids);
      [...marketList.children].forEach((li, i) => { li.querySelector('.market-item__rank').textContent = i + 1; });
    });

    renderMarkets();
  }

  document.getElementById('main').hidden = false;

  document.getElementById('avatar-change').addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    avatarInput.value = '';
    showMessage(avatarMessage, '');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showMessage(avatarMessage, 'Please choose an image file.', true);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showMessage(avatarMessage, 'That image is too large (max 20 MB).', true);
      return;
    }

    objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      showMessage(avatarMessage, 'That image could not be opened. Try a JPG or PNG.', true);
      return;
    }

    showMessage(cropMessage, '');
    cropDialog.showModal();
    cropper.load(img);
  });

  cropDialog.addEventListener('close', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  });

  document.getElementById('crop-cancel').addEventListener('click', () => cropDialog.close());

  cropSaveBtn.addEventListener('click', async () => {
    cropSaveBtn.disabled = true;
    showMessage(cropMessage, '');
    try {
      const blob = await cropper.toBlob();
      avatarPath = await uploadAvatar(user.id, blob, avatarPath);
      avatarUrl = await getAvatarUrl(avatarPath);
      renderAvatars();
      cropDialog.close();
      showMessage(avatarMessage, 'Profile picture updated.');
    } catch (error) {
      showMessage(cropMessage, `Could not upload: ${error.message}`, true);
    } finally {
      cropSaveBtn.disabled = false;
    }
  });

  avatarRemoveBtn.addEventListener('click', async () => {
    avatarRemoveBtn.disabled = true;
    try {
      await removeAvatar(user.id, avatarPath);
      avatarPath = null;
      avatarUrl = null;
      renderAvatars();
      showMessage(avatarMessage, 'Profile picture removed.');
    } catch (error) {
      showMessage(avatarMessage, `Could not remove: ${error.message}`, true);
    } finally {
      avatarRemoveBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    showMessage(message, '');

    const updates = { id: user.id };
    for (const field of FIELDS) updates[field] = form.elements[field].value.trim() || null;
    updates.archive_retention_days = retentionSelect.value === 'never' ? null : Number(retentionSelect.value);
    if (!marketsError) {
      SUPERMARKET_SLOTS.forEach((slot, i) => { updates[slot] = selectedMarkets[i] ?? null; });
    }

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) {
      showMessage(message, `Could not save: ${error.message}`, true);
    } else {
      showMessage(message, 'Profile saved.');
      renderAvatars();
    }
    submitBtn.disabled = false;
  });
}
