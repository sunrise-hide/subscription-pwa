// js/supabase.js - Supabase 初期化 & DB 操作

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- 認証 ----

export async function signInWithGitHub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

// ---- サブスクリプション CRUD ----

export async function fetchSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('next_billing_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addSubscription(sub) {
  const session = await getSession();
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...sub, user_id: session.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubscription(id, updates) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubscription(id) {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
