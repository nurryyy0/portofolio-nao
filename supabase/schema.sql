-- ============================================================
-- Portfolio DB Schema — jalankan di Supabase SQL Editor
-- (Project Settings -> SQL Editor -> New query -> paste -> Run)
-- ============================================================

-- ── Tabel projects ────────────────────────────────────────────
create table if not exists public.projects (
  id          text primary key,
  title       text not null default '',
  short_desc  text not null default '',
  description text not null default '',
  category    text not null default '',
  year        text not null default '',
  tags        jsonb not null default '[]'::jsonb,
  thumb       text,
  github_link text not null default '#',
  live_link   text not null default '',
  featured    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Tabel experiences ─────────────────────────────────────────
create table if not exists public.experiences (
  id          text primary key,
  category    text not null default '',
  title       text not null default '',
  institution text not null default '',
  start_date  text not null default '',
  description text not null default '',
  link        text not null default '',
  image       text,
  tags        jsonb not null default '[]'::jsonb,
  highlights  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- ── Baris awal (seed) — 6 project default ─────────────────────
insert into public.projects (id, title, short_desc, description, category, year, tags, thumb, github_link) values
  ('1', 'SmartLand Project', 'Aplikasi berbasis Streamlit yang dirancang untuk memprediksi tingkat kesuburan tanah menggunakan algoritma Machine Learning', 'Sistem cerdas untuk menentukan tingkat kesuburan menjadi Kurang Subur, Cukup Subur, atau Sangat Subur, berdasarkan berbagai parameter kimia tanah secara cepat, praktis, dan mudah digunakan. ', 'App', '2026', '["Python","Streamlit"]'::jsonb, 'smartland.png', 'https://github.com/nurryyy0/Project-Akhir'),
  ('2', 'Poertofolio Web', 'Web Portofolio Nurry Nurul Naomi', 'Web Portofolio pertama saya sebagai siswa SMK, yang dibangun dengan React dan Vite untuk menciptakan web yang interaktif dan responsif.', 'Web', '2026', '["React","Node.js","Vite"]'::jsonb, 'porto.png', '#'),
  ('3', 'The Noyescape', 'Game platformer 2D pixel art bertema petualangan luar angkasa.', 'NoyeScape adalah game platformer 2D pixel art yang mengikuti petualangan Noye, seorang astronot muda yang harus melewati berbagai rintangan dan mengumpulkan item untuk mencapai portal dan menyelesaikan setiap level.', 'Game', '2025', '["Turbowarp"]'::jsonb, 'noyescape.jpeg', 'https://github.com/nurryyy0/Game-The-Noyescape'),
  ('4', 'SuperStar', 'Game lompat-lompatan ala platformer klasik.', 'Game platformer 2D yang mengajak pemain mengendalikan seekor kucing lincah untuk melompati rintangan, mengumpulkan koin, dan mencapai target.', 'Game', '2024', '["scratch"]'::jsonb, 'superstar.png', 'https://github.com/nurryyy0/SuperStar-Game-2024'),
  ('5', 'Web Wisata', 'Membangun web antarmuka yang menonjolkan aspek visual pariwisata Jawa Timur', 'Proyek pengembangan front-end untuk membangun direktori wisata Jawa Timur. Fokus pada implementasi desain responsif, optimasi performa loading gambar', 'Web', '2025', '["HTML","CSS","JavaScript"]'::jsonb, 'webwisata.jpeg', 'https://github.com/nurryyy0/web-wisata-frontend'),
  ('6', 'Klasifikasi Kopi', 'Menilai kualitas kopi lebih cepat dengan analisis berbasis data', 'Aplikasi ini dikembangkan menggunakan Streamlit dan Machine Learning untuk melakukan klasifikasi kualitas kopi berdasarkan karakteristik tertentu. Sistem memberikan hasil prediksi secara real-time lengkap dengan tingkat kepercayaan model terhadap hasil yang diberikan.', 'App', '2025', '["Python","Streamlit"]'::jsonb, 'klasskopi.png', 'https://github.com/nurryyy0/klasifikasi_kopi')
on conflict (id) do nothing;

-- ── Baris awal (seed) — 6 experience default ──────────────────
insert into public.experiences (id, category, title, institution, start_date, description, link, image) values
  ('e1', 'Lomba', 'LKS Broadcasting', 'LKS Kabupaten Purbalingga', '2026', 'Mengikuti Lomba Kompetensi Siswa (LKS) sebagai sarana untuk mengembangkan keterampilan, menambah pengalaman, dan mengasah kemampuan di bidang keahlian yang dipelajari.', '', 'lks.jpeg'),
  ('e2', 'Organisasi', 'Ketua IPPNU Ranting Desa Kalitinggar Kidul', 'Desa Kalitingar Kidul', '2022', 'Menjabat sebagai Ketua IPPNU Desa Kalikid dan bertanggung jawab dalam mengoordinasikan kegiatan organisasi, memimpin anggota, serta mengembangkan program yang bermanfaat bagi pelajar dan masyarakat.', '', 'ipp.jpeg'),
  ('e3', 'Ekstrakurikuler', 'Anggota Pramuka', 'SMKN 1 Purbalingga', '2025', 'Aktif mengikuti kegiatan kepramukaan yang berfokus pada pengembangan karakter, kedisiplinan, kerja sama tim, serta keterampilan kepemimpinan.', '', 'sankar.jpeg'),
  ('e4', 'Ekstrakurikuler', 'Tim Putri Basket SMEGA', 'SMKN 1 Purbalingga', '2025', 'Menjadi bagian dari tim basket putri SMK N 1 Purbalingga dan berpartisipasi dalam latihan serta berbagai kegiatan dan kompetisi olahraga sekolah.', '', 'basket.jpeg'),
  ('e5', 'Lomba', 'Film Pendek FLS3N 2026', 'FLS3N Kabupaten Purbalingga', '2026', 'Terpilih sebagai bagian dari tim inti FLS3N sekolah dan berkontribusi dalam persiapan serta pelaksanaan lomba untuk mewakili sekolah.', '', 'fls.jpeg'),
  ('e6', 'Organisasi', 'Sekretaris Posyandu Remaja Tunas Harapan', 'Desa Kalitingar Kidul', '2026', 'Menjabat sebagai Sekretaris Posyandu Remaja Kalkid dengan tugas membantu administrasi, pencatatan kegiatan, penyusunan laporan, serta mendukung kelancaran program dan kegiatan remaja.', '', 'posyn.jpeg')
on conflict (id) do nothing;

-- ── Security: PUBLIC read-only, ADMIN boleh CRUD ────────────────
-- ⚠️ GANTI 'admin2@naomi.dev' dengan email admin kamu (sama dengan
--    VITE_ADMIN_EMAIL di file .env), lalu buat user admin di
--    Authentication -> Users -> Add user.
alter table public.projects     enable row level security;
alter table public.experiences  enable row level security;

-- Grant: anon hanya boleh baca; authenticated (admin) boleh tulis
revoke  insert, update, delete on public.projects    from anon;
revoke  insert, update, delete on public.experiences from anon;
grant   insert, update, delete on public.projects    to authenticated;
grant   insert, update, delete on public.experiences to authenticated;

-- Policy SELECT: siapa saja (anon) boleh membaca
drop policy if exists "projects_select"    on public.projects;
drop policy if exists "experiences_select" on public.experiences;

create policy "projects_select"     on public.projects    for select to anon, authenticated using (true);
create policy "experiences_select"  on public.experiences for select to anon, authenticated using (true);

-- Policy INSERT/UPDATE/DELETE: HANYA admin (email di atas)
drop policy if exists "admin_projects_insert"    on public.projects;
drop policy if exists "admin_projects_update"    on public.projects;
drop policy if exists "admin_projects_delete"    on public.projects;
drop policy if exists "admin_experiences_insert" on public.experiences;
drop policy if exists "admin_experiences_update" on public.experiences;
drop policy if exists "admin_experiences_delete" on public.experiences;

create policy "admin_projects_insert" on public.projects
  for insert to authenticated
  with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));
create policy "admin_projects_update" on public.projects
  for update to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'))
  with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));
create policy "admin_projects_delete" on public.projects
  for delete to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));
create policy "admin_experiences_insert" on public.experiences
  for insert to authenticated
  with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));
create policy "admin_experiences_update" on public.experiences
  for update to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'))
  with check ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));
create policy "admin_experiences_delete" on public.experiences
  for delete to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = lower('admin2@naomi.dev'));