create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  category text not null,
  description text not null check (char_length(description) between 10 and 2000),
  price numeric(10, 2) not null check (price > 0 and price <= 10000),
  image_url text not null,
  featured boolean not null default false,
  active boolean not null default true,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  access_token uuid not null unique,
  checkout_key uuid not null unique,
  product_id uuid not null references public.products(id),
  amount numeric(10, 2) not null check (amount > 0),
  customer_name text not null,
  customer_email text not null,
  transaction_id text unique,
  pix_code text,
  pix_qr text,
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_settings enable row level security;
alter table public.orders enable row level security;

insert into public.categories (name)
values ('Doces finos'), ('Brigadeiros'), ('Bolos')
on conflict (name) do nothing;

insert into public.site_settings (key, value)
values (
  'store',
  '{
    "background_color": "#fffaf7",
    "hero_image": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1400&q=85",
    "announcement": "Receitas que transformam sua cozinha em um ateliê",
    "gateway_enabled": false
  }'::jsonb
)
on conflict (key) do nothing;

insert into public.products (
  name, category, description, price, image_url, featured
)
select
  'Doces Finos para Encantar',
  'Doces finos',
  'Um guia completo para criar doces delicados, vender com confiança e conquistar clientes desde a primeira encomenda.',
  47.00,
  'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85',
  true
where not exists (
  select 1 from public.products where name = 'Doces Finos para Encantar'
);

insert into public.products (
  name, category, description, price, image_url, featured
)
select
  'Brigadeiros de Vitrine',
  'Brigadeiros',
  'Massas no ponto perfeito, combinações irresistíveis e acabamento profissional para valorizar cada caixinha.',
  37.00,
  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85',
  false
where not exists (
  select 1 from public.products where name = 'Brigadeiros de Vitrine'
);

insert into public.products (
  name, category, description, price, image_url, featured
)
select
  'Bolos Afetivos & Recheios',
  'Bolos',
  'Receitas testadas, recheios equilibrados e montagem sem mistério para bolos que viram memória boa.',
  57.00,
  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85',
  false
where not exists (
  select 1 from public.products where name = 'Bolos Afetivos & Recheios'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-pdfs', 'course-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf'];
