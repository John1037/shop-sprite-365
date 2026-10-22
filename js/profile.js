// /profile: view and edit the signed-in user's profile.
import { supabase } from './supabase.js';
import { requireUser, wireLogout } from './auth.js';

const FIELDS = ['full_name', 'display_name', 'phone', 'postcode'];

const form = document.getElementById('profile-form');
const submitBtn = document.getElementById('profile-submit');
const message = document.getElementById('profile-message');

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('form-message--error', isError);
}

const user = await requireUser();

if (user) {
  wireLogout(document.getElementById('logout-btn'));
  form.elements.email.value = user.email;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(FIELDS.join(', '))
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    showMessage(`Could not load profile: ${error.message}`, true);
  } else if (profile) {
    for (const field of FIELDS) form.elements[field].value = profile[field] ?? '';
  }

  document.getElementById('main').hidden = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    showMessage('');

    const updates = { id: user.id };
    for (const field of FIELDS) updates[field] = form.elements[field].value.trim() || null;

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) {
      showMessage(`Could not save: ${error.message}`, true);
    } else {
      showMessage('Profile saved.');
    }
    submitBtn.disabled = false;
  });
}
