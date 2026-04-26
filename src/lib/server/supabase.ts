// Server-side Supabase client. Uses the service_role key, which bypasses
// RLS - so policies don't apply to queries made through this client. Never
// import this file from $lib (the publicly-exposed alias) and never let it
// reach the browser bundle. Server endpoints and form actions only.

import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { SUPABASE_SERVICE_ROLE_KEY } from "$env/static/private";

export const supabaseAdmin = createClient(
  PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
