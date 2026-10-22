// /main: landing page after log in.
import { supabase } from './supabase.js';
import { requireUser } from './auth.js';
import { getAvatarUrl } from './avatar.js';
import { initUserMenu } from './user-menu.js';

const user = await requireUser();

if (user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_path')
    .eq('id', user.id)
    .maybeSingle();

  initUserMenu(await getAvatarUrl(profile?.avatar_path), profile?.display_name || user.email);

  if (profile?.display_name) {
    document.getElementById('welcome-name').textContent = `, ${profile.display_name}`;
  }

  document.getElementById('main').hidden = false;
}
