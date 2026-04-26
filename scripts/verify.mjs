// Quick post-migration sanity check. Lists v1 tables and seed-row counts.
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const tables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name not like 'pg_%'
  order by table_name
`);
console.log("Tables in public schema:");
for (const r of tables.rows) console.log("  -", r.table_name);

const rls = await client.query(`
  select tablename, rowsecurity
  from pg_tables
  where schemaname = 'public'
  order by tablename
`);
console.log("\nRLS enabled:");
for (const r of rls.rows)
  console.log(`  ${r.rowsecurity ? "yes" : "NO "} ${r.tablename}`);

const policies = await client.query(`
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
`);
console.log("\nPolicies:");
for (const r of policies.rows)
  console.log(`  ${r.tablename}.${r.policyname} (${r.cmd})`);

const counts = await client.query(`
  select 'disciplines' as t, count(*)::int as n from public.disciplines
  union all select 'site_content', count(*)::int from public.site_content
  union all select 'email_templates', count(*)::int from public.email_templates
  order by t
`);
console.log("\nSeed row counts:");
for (const r of counts.rows) console.log(`  ${r.t}: ${r.n}`);

await client.end();
