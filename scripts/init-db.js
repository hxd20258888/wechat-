/**
 * 初始化数据库：执行 sql/schema.sql + sql/seed.sql
 * 用法：node scripts/init-db.js
 * 依赖 .env 中的 DATABASE_URL（或系统环境变量）
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

// 极简 .env 解析（不引入额外依赖）
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('缺少 DATABASE_URL，请在 .env 或环境变量中配置');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    // Supabase / Neon 均要求 SSL，统一开启
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '..', 'sql', 'seed.sql'), 'utf8');

  console.log('正在创建表结构...');
  await client.query(schema);

  console.log('正在写入种子数据...');
  await client.query(seed);

  console.log('数据库初始化完成 ✓');
  await client.end();
}

main().catch((err) => {
  console.error('数据库初始化失败:', err.message);
  process.exit(1);
});
