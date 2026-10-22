// /profile: view and edit the signed-in user's profile.
import { supabase } from './supabase.js';
import { requireUser } from './auth.js';
import { getAvatarUrl, uploadAvatar, removeAvatar, renderAvatar } from './avatar.js';
import { createCropper } from './cropper.js';
import { initUserMenu, setMenuAvatar } from './user-menu.js';

const FIELDS = ['full_name', 'display_name', 'phone', 'postcode'];
const MAX_SUPERMARKETS = 6;
const SUPERMARKET_SLOTS = Array.from({ length: MAX_SUPERMARKETS }, (_, i) => `supermarket_${i + 1}`);
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
    .select([...FIELDS, ...SUPERMARKET_SLOTS, 'avatar_path'].join(', '))
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    showMessage(message, `Could not load profile: ${error.message}`, true);
  } else if (profile) {
    for (const field of FIELDS) form.elements[field].value = profile[field] ?? '';
  }

  let avatarPath = profile?.avatar_path ?? null;
  let avatarUrl = await getAvatarUrl(avatarPath);
  let objectUrl = null;

  const displayName = () => form.elements.display_name.value.trim() || user.email;

  function renderAvatars() {
    renderAvatar(avatarEl, avatarUrl, displayName());
    setMenuAvatar(avatarUrl, displayName());
    avatarRemoveBtn.hidden = !avatarPath;
  }

  initUserMenu(avatarUrl, displayName());
  renderAvatars();

  // Preferred supermarkets, in order of preference (slot 1 first).
  const marketList = document.getElementById('market-list');
  const marketCount = document.getElementById('market-count');
  const selectedMarkets = SUPERMARKET_SLOTS.map((slot) => profile?.[slot]).filter(Boolean);

  const { data: markets, error: marketsError } = await supabase
    .from('supermarkets')
    .select('id, name, is_active')
    .order('name');

  function renderMarketState() {
    const full = selectedMarkets.length >= MAX_SUPERMARKETS;
    for (const input of marketList.querySelectorAll('input')) {
      const rank = selectedMarkets.indexOf(input.value);
      input.checked = rank !== -1;
      input.disabled = full && rank === -1;
      input.closest('.market-option').querySelector('.market-option__rank').textContent = rank === -1 ? '' : rank + 1;
    }
    marketCount.textContent = `${selectedMarkets.length} of ${MAX_SUPERMARKETS} selected, numbered in order of preference.`;
  }

  if (marketsError) {
    showMessage(marketCount, `Could not load supermarkets: ${marketsError.message}`, true);
  } else {
    // Hide retired supermarkets unless the user already has them selected.
    for (const market of markets.filter((m) => m.is_active || selectedMarkets.includes(m.id))) {
      const option = document.createElement('label');
      option.className = 'market-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = market.id;
      const name = document.createElement('span');
      name.textContent = market.name;
      const rank = document.createElement('span');
      rank.className = 'market-option__rank';
      option.append(input, name, rank);
      marketList.append(option);
    }

    marketList.addEventListener('change', (event) => {
      const id = event.target.value;
      const index = selectedMarkets.indexOf(id);
      if (event.target.checked && index === -1) selectedMarkets.push(id);
      if (!event.target.checked && index !== -1) selectedMarkets.splice(index, 1);
      renderMarketState();
    });

    renderMarketState();
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
