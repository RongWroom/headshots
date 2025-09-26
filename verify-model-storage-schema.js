// Model Storage Schema Verification
// Verifies that the database schema has been properly created

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySchema() {
  console.log('🔍 Verifying Model Storage Schema...\n');

  const tables = [
    'model_weights',
    'model_shares', 
    'model_cleanup_log',
    'model_exports'
  ];

  const functions = [
    'cleanup_expired_model_weights',
    'cleanup_expired_model_shares',
    'cleanup_expired_model_exports'
  ];

  let allGood = true;

  // Check tables exist
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Table '${table}' - ERROR: ${error.message}`);
        allGood = false;
      } else {
        console.log(`✅ Table '${table}' - OK`);
      }
    } catch (error) {
      console.log(`❌ Table '${table}' - ERROR: ${error.message}`);
      allGood = false;
    }
  }

  console.log('');

  // Check functions exist
  for (const func of functions) {
    try {
      const { data, error } = await supabase.rpc(func);
      
      if (error && !error.message.includes('permission denied')) {
        console.log(`❌ Function '${func}' - ERROR: ${error.message}`);
        allGood = false;
      } else {
        console.log(`✅ Function '${func}' - OK`);
      }
    } catch (error) {
      console.log(`❌ Function '${func}' - ERROR: ${error.message}`);
      allGood = false;
    }
  }

  console.log('');

  // Check if we can insert a test record
  try {
    // First create a test model
    const { data: model, error: modelError } = await supabase
      .from('models')
      .insert({
        name: 'Schema Test Model',
        type: 'test',
        status: 'completed',
        user_id: '00000000-0000-0000-0000-000000000000' // Test UUID
      })
      .select()
      .single();

    if (modelError) {
      console.log(`❌ Test model creation - ERROR: ${modelError.message}`);
      allGood = false;
    } else {
      console.log(`✅ Test model creation - OK`);

      // Test model weight insertion
      const { data: weight, error: weightError } = await supabase
        .from('model_weights')
        .insert({
          model_id: model.id,
          file_path: 'test/path.safetensors',
          file_size: 1024,
          file_hash: 'test-hash',
          metadata: { test: true },
          training_config: { test: true },
          quality_metrics: { test: true }
        })
        .select()
        .single();

      if (weightError) {
        console.log(`❌ Test model weight insertion - ERROR: ${weightError.message}`);
        allGood = false;
      } else {
        console.log(`✅ Test model weight insertion - OK`);

        // Clean up test data
        await supabase.from('model_weights').delete().eq('id', weight.id);
      }

      // Clean up test model
      await supabase.from('models').delete().eq('id', model.id);
    }
  } catch (error) {
    console.log(`❌ Test data operations - ERROR: ${error.message}`);
    allGood = false;
  }

  console.log('\n' + '='.repeat(50));
  
  if (allGood) {
    console.log('🎉 Model Storage Schema Verification PASSED');
    console.log('✅ All tables, functions, and operations are working correctly');
  } else {
    console.log('❌ Model Storage Schema Verification FAILED');
    console.log('⚠️  Some components are missing or not working properly');
    console.log('💡 Make sure to run the migration: supabase/migrations/20250927000000_add_model_storage_system.sql');
  }

  process.exit(allGood ? 0 : 1);
}

verifySchema().catch(error => {
  console.error('❌ Schema verification failed:', error);
  process.exit(1);
});