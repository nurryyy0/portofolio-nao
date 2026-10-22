// ─── Admin Auth helpers ────────────────────────────────────────────
// Login/logout admin via Supabase Auth. Keamanan utama tetap di sisi
// database (RLS): hanya email admin yang bisa INSERT/UPDATE/DELETE.
// Frontend hanya menyembunyikan/menampilkan tombol CRUD.

import { useEffect, useState } from "react";
import {
  getSupabase,
  getCachedSession,
  isSupabaseEnabled,
  ADMIN_EMAIL,
  isAdminUser,
} from "./storage";

export { ADMIN_EMAIL };

/** Login admin dengan email + password (Supabase Auth). */
export async function signInAdmin(email, password) {
  if (!isSupabaseEnabled) {
    return { error: { message: "Supabase belum dikonfigurasi." } };
  }
  const sb = await getSupabase();
  if (!sb) return { error: { message: "Supabase belum dikonfigurasi." } };
  return sb.auth.signInWithPassword({ email, password });
}

/** Keluar dari sesi admin. */
export async function signOutAdmin() {
  if (!isSupabaseEnabled) return;
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

/** Hook: `isAdmin` true kalau user yang login adalah admin.
 *  Sumber kebenaran: fungsi RPC `app_is_admin()` (berbasis tabel `admins`);
 *  kalau belum ada (deployment lama), fallback ke email VITE_ADMIN_EMAIL.
 *
 *  Catatan performance: client Supabase di-load lazy (setelah render),
 *  sesi diambil lewat getCachedSession (dedupe dengan trackVisit), dan
 *  hasil cek admin di-cache di storage.js — navigasi antar halaman tidak
 *  mengulang RPC `app_is_admin`. Tampilan/tombol admin tetap sama. */
export function useAdmin() {
  // Saat Supabase nonaktif: langsung ketahuan bukan admin (tanpa cek sesi).
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [checking, setChecking] = useState(isSupabaseEnabled);

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    let active = true;
    let sub = null;
    const apply = (user) => {
      if (!active) return;
      setSessionUser(user || null);
      isAdminUser(user?.email || null).then((flag) => {
        if (!active) return;
        setIsAdmin(Boolean(flag));
        setChecking(false);
      });
    };

    // Ambil sesi yang sudah ada (misal setelah refresh halaman).
    getCachedSession()
      .then(({ session }) => {
        apply(session?.user || null);
      })
      .catch(() => {
        if (active) setChecking(false);
      });

    // Reaksi saat login/logout terjadi (termasuk di tab lain).
    getSupabase().then((sb) => {
      if (!active || !sb) {
        if (active) setChecking(false);
        return;
      }
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        apply(session?.user || null);
      });
      sub = data;
      // Kalau komponen sudah unmount sebelum promise selesai, langsung lepas.
      if (!active) sub?.subscription?.unsubscribe();
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return { isAdmin, sessionUser, checking };
}
