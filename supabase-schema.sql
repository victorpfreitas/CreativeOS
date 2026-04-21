-- ============================================================
-- Made by Human — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Projects (clients)
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  knowledge_base text default '',
  created_at timestamp with time zone default now()
);

-- Image Collections
create table if not exists image_collections (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('hook', 'body')),
  created_at timestamp with time zone default now()
);

-- Collection Images
create table if not exists collection_images (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid not null references image_collections(id) on delete cascade,
  url text not null,
  source text not null default 'pexels' check (source in ('pexels', 'unsplash', 'upload')),
  created_at timestamp with time zone default now()
);

-- Automations
create table if not exists automations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  niche text not null default '',
  narrative_prompt text default '',
  format_prompt text default '',
  soft_cta text default '',
  schedule_days text[] default '{}',
  schedule_time time default '10:00',
  schedule_timezone text default 'America/Sao_Paulo',
  status text not null default 'active' check (status in ('active', 'paused')),
  hook_collection_id uuid references image_collections(id) on delete set null,
  body_collection_id uuid references image_collections(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Hooks (slideshow ideas)
create table if not exists hooks (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references automations(id) on delete cascade,
  text text not null,
  used boolean default false,
  created_at timestamp with time zone default now()
);

-- Slideshows (generated carousels)
create table if not exists slideshows (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references automations(id) on delete cascade,
  hook_id uuid not null references hooks(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  scheduled_for timestamp with time zone,
  slides jsonb not null default '[]',
  caption text default '',
  created_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists idx_automations_project on automations(project_id);
create index if not exists idx_hooks_automation on hooks(automation_id);
create index if not exists idx_slideshows_automation on slideshows(automation_id);
create index if not exists idx_collection_images_collection on collection_images(collection_id);
create index if not exists idx_slideshows_scheduled on slideshows(scheduled_for);

-- Row Level Security (disabled for now — internal tool)
alter table projects enable row level security;
alter table automations enable row level security;
alter table hooks enable row level security;
alter table slideshows enable row level security;
alter table image_collections enable row level security;
alter table collection_images enable row level security;

-- Allow all operations (internal tool, no auth needed)
create policy "Allow all on projects" on projects for all using (true) with check (true);
create policy "Allow all on automations" on automations for all using (true) with check (true);
create policy "Allow all on hooks" on hooks for all using (true) with check (true);
create policy "Allow all on slideshows" on slideshows for all using (true) with check (true);
create policy "Allow all on image_collections" on image_collections for all using (true) with check (true);
create policy "Allow all on collection_images" on collection_images for all using (true) with check (true);
