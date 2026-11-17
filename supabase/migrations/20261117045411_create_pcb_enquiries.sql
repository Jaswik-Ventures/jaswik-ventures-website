-- Jaswik Ventures PCB enquiry storage
-- Run this in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.pcb_enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_ref text not null unique,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  mobile_number text not null check (char_length(mobile_number) between 8 and 24),
  currency text not null check (currency in ('INR','USD')),
  layer_count text not null check (layer_count in ('2','4','6+')),
  component_count integer not null check (component_count between 10 and 1000),
  starting_point text not null,
  technical_complexity jsonb not null default '[]'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  custom_parts integer not null default 0 check (custom_parts between 0 and 100),
  turnaround text not null,
  design_subtotal numeric(12,2) not null check (design_subtotal >= 0),
  gst_rate numeric(5,4) not null default 0.18,
  gst_amount numeric(12,2) not null check (gst_amount >= 0),
  quotation_total numeric(12,2) not null check (quotation_total >= 0),
  delivery_days text not null,
  quote_breakdown jsonb not null default '[]'::jsonb,
  quote_text text not null,
  status text not null default 'new'
    check (status in ('new','contacted','in_progress','quoted','closed','spam')),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists pcb_enquiries_created_at_idx
  on public.pcb_enquiries (created_at desc);
create index if not exists pcb_enquiries_mobile_idx
  on public.pcb_enquiries (mobile_number);

alter table public.pcb_enquiries enable row level security;

-- No anon/authenticated SELECT, INSERT, UPDATE or DELETE policies are created.
-- Public visitors submit only through the Edge Function. The function uses
-- SUPABASE_SERVICE_ROLE_KEY server-side; never put that key in index.html.
revoke all on public.pcb_enquiries from anon, authenticated;
grant all on public.pcb_enquiries to service_role;
