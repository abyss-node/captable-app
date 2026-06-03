import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);

export type DbCapTable = {
  id: string;
  user_id: string;
  name: string;
  data: unknown;       // serialised CapTable JSON
  created_at: string;
  updated_at: string;
};

export type DbAuditEntry = {
  id: string;
  cap_table_id: string;
  user_id: string;
  action: string;
  description: string;
  meta: unknown;
  created_at: string;
};

export type DbRoundHistory = {
  id: string;
  cap_table_id: string;
  user_id: string;
  data: unknown;       // serialised RoundHistory JSON
  updated_at: string;
};
