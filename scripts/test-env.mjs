import { existsSync } from 'node:fs';
export function loadTestEnvironment() {
  for (const file of ['.env.local','.env.test.local']) if (existsSync(file)) process.loadEnvFile(file);
}
export function integrationConfig() {
  loadTestEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const aEmail = process.env.TEST_USER_A_EMAIL;
  const aPassword = process.env.TEST_USER_A_PASSWORD;
  const bEmail = process.env.TEST_USER_B_EMAIL;
  const bPassword = process.env.TEST_USER_B_PASSWORD;
  return url && key && aEmail && aPassword && bEmail && bPassword ? { url, key, aEmail, aPassword, bEmail, bPassword } : null;
}
