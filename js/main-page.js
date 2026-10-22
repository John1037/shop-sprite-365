// /main: landing page after log in.
import { requireUser } from './auth.js';
import { loadTopbar } from './topbar.js';

const user = await requireUser();

if (user) {
  const profile = await loadTopbar(user);

  if (profile?.display_name) {
    document.getElementById('welcome-name').textContent = `, ${profile.display_name}`;
  }

  document.getElementById('main').hidden = false;
}
