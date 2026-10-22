// Entry point for ShopSprite 365 front-end behaviour.
import { supabase } from './supabase.js';

const signedOutActions = document.getElementById('signed-out-actions');
const signedInActions = document.getElementById('signed-in-actions');
const userEmail = document.getElementById('user-email');

const dialog = document.getElementById('auth-dialog');
const form = document.getElementById('auth-form');
const title = document.getElementById('auth-title');
const submitBtn = document.getElementById('auth-submit');
const message = document.getElementById('auth-message');
const switchText = document.getElementById('auth-switch-text');
const switchBtn = document.getElementById('auth-switch');
const passwordInput = form.elements.password;

let mode = 'login';

function setMode(newMode) {
  mode = newMode;
  const isLogin = mode === 'login';
  title.textContent = isLogin ? 'Log in' : 'Sign up';
  submitBtn.textContent = isLogin ? 'Log in' : 'Create account';
  switchText.textContent = isLogin ? 'No account yet?' : 'Already have an account?';
  switchBtn.textContent = isLogin ? 'Sign up' : 'Log in';
  passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
  showMessage('');
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('auth-form__message--error', isError);
}

function openAuth(newMode) {
  form.reset();
  setMode(newMode);
  dialog.showModal();
}

function renderUser(user) {
  signedOutActions.hidden = Boolean(user);
  signedInActions.hidden = !user;
  userEmail.textContent = user ? user.email : '';
}

document.getElementById('login-btn').addEventListener('click', () => openAuth('login'));
document.getElementById('signup-btn').addEventListener('click', () => openAuth('signup'));
document.getElementById('auth-close').addEventListener('click', () => dialog.close());
switchBtn.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

document.getElementById('logout-btn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Sign out failed:', error.message);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = form.elements.email.value.trim();
  const password = passwordInput.value;

  submitBtn.disabled = true;
  showMessage('');

  try {
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      dialog.close();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data.session) {
        dialog.close();
      } else {
        showMessage('Check your email to confirm your account.');
      }
    }
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  renderUser(session?.user ?? null);
});
