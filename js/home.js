// Home page: log in / sign up.
import { supabase } from './supabase.js';

const MAIN_PAGE = '/main';

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

// Already signed in? Skip the form and go straight to the app.
document.getElementById('login-btn').addEventListener('click', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.assign(MAIN_PAGE);
  } else {
    openAuth('login');
  }
});

document.getElementById('signup-btn').addEventListener('click', () => openAuth('signup'));
document.getElementById('auth-close').addEventListener('click', () => dialog.close());
switchBtn.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

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
      window.location.assign(MAIN_PAGE);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + MAIN_PAGE },
      });
      if (error) throw error;
      if (data.session) {
        window.location.assign(MAIN_PAGE);
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
