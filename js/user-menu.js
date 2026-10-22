// Top bar account menu: avatar button with Profile / Log out drop-down.
import { renderAvatar } from './avatar.js';
import { wireLogout } from './auth.js';

const button = document.getElementById('user-menu-btn');
const list = document.getElementById('user-menu-list');
const avatarEl = document.getElementById('topbar-avatar');

function setOpen(open) {
  list.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

export function initUserMenu(avatarUrl, name) {
  renderAvatar(avatarEl, avatarUrl, name);
  wireLogout(document.getElementById('logout-btn'));

  button.addEventListener('click', () => setOpen(list.hidden));

  document.addEventListener('click', (event) => {
    if (!list.hidden && !event.target.closest('.user-menu')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !list.hidden) {
      setOpen(false);
      button.focus();
    }
  });
}

export function setMenuAvatar(avatarUrl, name) {
  renderAvatar(avatarEl, avatarUrl, name);
}
