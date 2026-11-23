// Applies server/schema.ts to DATABASE_URL (Supabase). Run: npm run db:migrate
import { connectPostgres, migrate } from '../server/db'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Set DATABASE_URL (Supabase: Project Settings, Database, Connection string)')
await migrate(connectPostgres(url))
console.log('Schema applied.')
process.exit(0)
