import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_USER_EMAIL!;
  const password = process.env.DEMO_USER_PASSWORD!;

  console.log(`Attempting to create user ${email}...`);

  console.log(`Attempting to confirm user ${email}...`);

  // 2. Force confirm the email directly in the database
  console.log('Forcing email confirmation in the database...');
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = $1`,
      email
    );
    console.log('User confirmed in database.');
  } catch (dbError) {
    console.error('Failed to confirm user in database:', dbError);
    // Continue anyway as it might have been auto-confirmed by Supabase settings
  }

  // 3. Test sign in
  console.log('Testing sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.error('Failed to sign in demo user:', signInError);
    process.exit(1);
  }

  console.log('✅ Demo user successfully authenticated!');
  console.log('User ID:', signInData.user.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
