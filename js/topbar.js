// Signed-in top bar: Shops menu and avatar account menu.
import { supabase } from './supabase.js';
import { getAvatarUrl, renderAvatar } from './avatar.js';
import { wireLogout } from './auth.js';

const avatarEl = document.getElementById('topbar-avatar');

function setupMenus() {
  const menus = [...document.querySelectorAll('.menu')].map((menu) => ({
    button: menu.querySelector('.menu__btn'),
    list: menu.querySelector('.menu__list'),
  }));

  const setOpen = (menu, open) => {
    menu.list.hidden = !open;
    menu.button.setAttribute('aria-expanded', String(open));
  };
  const closeAll = () => menus.forEach((menu) => setOpen(menu, false));

  for (const menu of menus) {
    menu.button.addEventListener('click', () => {
      const open = menu.list.hidden;
      closeAll();
      setOpen(menu, open);
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu')) closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = menus.find((menu) => !menu.list.hidden);
    if (open) {
      setOpen(open, false);
      open.button.focus();
    }
  });
}

export function initTopbar(avatarUrl, name) {
  renderAvatar(avatarEl, avatarUrl, name);
  wireLogout(document.getElementById('logout-btn'));
  setupMenus();
}

// Loads the user's name and picture, then sets up the top bar. Returns the profile.
export async function loadTopbar(user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_path')
    .eq('id', user.id)
    .maybeSingle();

  initTopbar(await getAvatarUrl(profile?.avatar_path), profile?.display_name || user.email);
  return profile;
}

export function setMenuAvatar(avatarUrl, name) {
  renderAvatar(avatarEl, avatarUrl, name);
}
