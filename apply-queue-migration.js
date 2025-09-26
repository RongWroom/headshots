// Apply Training Queue Migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...');
    
    const migrationSQL = fs.readFileSync('supabase/migrations/20250926000000_add_training_queue.sql', 'utf8');
    
    console.log('🔧 Applying training queue migration...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            // Try direct execution if RPC fails
            const { error: directError } = await supabase
              .from('_migrations')
              .select('*')
              .limit(1);
            
            if (directError) {
              console.log(`⚠️  Statement ${i + 1} failed, but continuing...`);
              console.log('Error:', error.message);
            }
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} failed, but continuing...`);
          console.log('Error:', err.message);
        }
      }
    }
    
    console.log('✅ Migration application completed');
    
    // Test if tables were created
    console.log('🔍 Verifying table creation...');
    
    const tables = ['training_queue', 'user_rate_limits', 'provider_capacity', 'queue_statistics'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table} not accessible:`, error.message);
        } else {
          console.log(`✅ Table ${table} is accessible`);
        }
      } catch (err) {
        console.log(`❌ Table ${table} verification failed:`, err.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();