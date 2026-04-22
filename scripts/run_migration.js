#!/usr/bin/env node
/* Execute all SQL files in scripts/migration-sql/ via pg.
 * Stops on first error. Reports row counts after each table.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('SUPABASE_DB_URL env var required');
  process.exit(1);
}

const SQL_DIR = path.join(__dirname, 'migration-sql');
const files = fs.readdirSync(SQL_DIR).filter(f => f.endsWith('.sql')).sort();

// Files to skip (already imported via MCP)
const SKIP = new Set(['01_settings.sql', '02_users.sql']);

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    // Force IPv6 resolution since direct host only has AAAA
    lookup: (hostname, opts, cb) => require('dns').lookup(hostname, { family: 6 }, cb),
  });
  await client.connect();
  console.log('Connected.');

  for (const file of files) {
    if (SKIP.has(file)) {
      console.log(`[SKIP] ${file} (already imported)`);
      continue;
    }
    const sqlPath = path.join(SQL_DIR, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const sizeKB = (Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1);
    process.stdout.write(`[RUN] ${file} (${sizeKB}KB) ... `);
    const start = Date.now();
    try {
      await client.query(sql);
      console.log(`OK (${Date.now() - start}ms)`);
    } catch (e) {
      console.log(`FAIL`);
      console.error(`Error in ${file}:`, e.message);
      // Show a few lines around error if position info available
      if (e.position) {
        const pos = parseInt(e.position, 10);
        const around = sql.slice(Math.max(0, pos - 200), pos + 100);
        console.error(`near: ...${around}...`);
      }
      await client.end();
      process.exit(1);
    }
  }

  console.log('\n=== Row counts ===');
  const counts = await client.query(`
    SELECT 'users' AS t, COUNT(*)::int AS c FROM public.users UNION ALL
    SELECT 'chat_sessions', COUNT(*)::int FROM public.chat_sessions UNION ALL
    SELECT 'chat_logs', COUNT(*)::int FROM public.chat_logs UNION ALL
    SELECT 'knowledge_sources', COUNT(*)::int FROM public.knowledge_sources UNION ALL
    SELECT 'settings', COUNT(*)::int FROM public.settings
  `);
  for (const r of counts.rows) console.log(`  ${r.t}: ${r.c}`);

  await client.end();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
