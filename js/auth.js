// Shared auth helpers for signed-in pages.
import { supabase } from './supabase.js';

// Returns the signed-in user, or sends the visitor back to the home page.
export async function requireUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('/');
    return null;
  }
  return session.user;
}

export function wireLogout(button) {
  button.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out failed:', error.message);
    window.location.replace('/');
  });
}

// Return to the home page if the user signs out in another tab.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') window.location.replace('/');
});
