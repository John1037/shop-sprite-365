// Profile picture storage and rendering.
import { supabase } from './supabase.js';

const BUCKET = 'avatars';
const SIGNED_URL_SECONDS = 60 * 60;

// The bucket is private, so images are shown through short-lived signed URLs.
export async function getAvatarUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) {
    console.error('Could not load avatar:', error.message);
    return null;
  }
  return data.signedUrl;
}

// Uploads under a new file name each time so browsers never show a cached old picture.
export async function uploadAvatar(userId, blob, oldPath) {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;

  const { error: dbError } = await supabase.from('profiles').upsert({ id: userId, avatar_path: path });
  if (dbError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw dbError;
  }

  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
  return path;
}

export async function removeAvatar(userId, path) {
  const { error } = await supabase.from('profiles').upsert({ id: userId, avatar_path: null });
  if (error) throw error;
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

// Shows the picture, or the first letter of the name when there is none.
export function renderAvatar(el, url, name) {
  el.replaceChildren();
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    el.append(img);
  } else {
    el.textContent = (name || '?').trim().charAt(0).toUpperCase();
  }
}
