// /main: landing page after log in.
import { supabase } from './supabase.js';
import { requireUser, wireLogout } from './auth.js';

const user = await requireUser();

if (user) {
  wireLogout(document.getElementById('logout-btn'));

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.display_name) {
    document.getElementById('welcome-name').textContent = `, ${profile.display_name}`;
  }

  document.getElementById('main').hidden = false;
}
