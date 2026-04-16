import db from '../src/db.js';

console.log('Running subscription_tier migration...');

try {
  db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK(subscription_tier IN ('free', 'explorer', 'guardian', 'navigator'));
  `);
  console.log('Successfully added subscription_tier column to users table');
} catch (error) {
  if (error.message.includes('duplicate column name') || error.message.includes('already exists')) {
    console.log('subscription_tier column already exists, skipping...');
  } else {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}
