#!/usr/bin/env node

/**
 * Row Level Security (RLS) Test Suite
 * 
 * This script tests that RLS policies are properly enforced across all tables:
 * - Users can only access their own credits
 * - Users can only access their own models
 * - Users cannot access other users' samples or images
 * - Service role can perform elevated operations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test configuration
const TEST_CONFIG = {
  // Test user credentials (these should be test accounts)
  testUsers: [
    {
      email: 'testuser1@example.com',
      password: 'testpassword123',
      name: 'Test User 1'
    },
    {
      email: 'testuser2@example.com', 
      password: 'testpassword123',
      name: 'Test User 2'
    }
  ],
  // Test data
  testModel: {
    name: 'Test Model',
    type: 'headshot',
    status: 'processing'
  },
  testSample: {
    uri: 'https://example.com/sample.jpg'
  },
  testImage: {
    uri: 'https://example.com/generated.jpg'
  }
};

class RLSTestSuite {
  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    this.supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseAnonKey || !this.supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    // Create clients for different roles
    this.anonClient = createClient(this.supabaseUrl, this.supabaseAnonKey);
    this.serviceClient = createClient(this.supabaseUrl, this.supabaseServiceKey);
    
    this.testResults = [];
    this.testUsers = [];
    this.testData = {};
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runTest(testName, testFn) {
    try {
      this.log(`Running test: ${testName}`);
      await testFn();
      this.testResults.push({ name: testName, status: 'PASS' });
      this.log(`Test passed: ${testName}`, 'success');
    } catch (error) {
      this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
      this.log(`Test failed: ${testName} - ${error.message}`, 'error');
    }
  }

  async setupTestUsers() {
    this.log('Setting up test users...');
    
    // Create test users using service role admin API
    for (let i = 0; i < TEST_CONFIG.testUsers.length; i++) {
      const userConfig = TEST_CONFIG.testUsers[i];
      
      // Create user using service role
      const { data: userData, error: createError } = await this.serviceClient.auth.admin.createUser({
        email: userConfig.email,
        password: userConfig.password,
        email_confirm: true // Auto-confirm email
      });
      
      if (createError && !createError.message.includes('already registered')) {
        throw new Error(`Failed to create test user ${userConfig.email}: ${createError.message}`);
      }
      
      // Create a client for this user and sign them in
      const client = createClient(this.supabaseUrl, this.supabaseAnonKey);
      const { data: authData, error: signInError } = await client.auth.signInWithPassword({
        email: userConfig.email,
        password: userConfig.password
      });
      
      if (signInError) {
        throw new Error(`Failed to sign in test user ${userConfig.email}: ${signInError.message}`);
      }
      
      this.testUsers.push({
        ...userConfig,
        client,
        user: authData.user,
        session: authData.session
      });
      
      this.log(`Set up test user: ${userConfig.email}`);
    }
    
    this.log(`Successfully set up ${this.testUsers.length} test users`);
  }

  async setupTestData() {
    this.log('Setting up test data...');
    
    // Create test data for each user
    for (let i = 0; i < this.testUsers.length; i++) {
      const testUser = this.testUsers[i];
      const userId = testUser.user.id;
      
      // Initialize credits for user using service role
      const { data: creditsData, error: creditsError } = await this.serviceClient
        .from('credits')
        .insert({ 
          user_id: userId, 
          credits: 10 
        })
        .select()
        .single();
      
      if (creditsError) {
        throw new Error(`Failed to create credits for user ${i + 1}: ${creditsError.message}`);
      }
      
      // Create a test model for this user
      const { data: modelData, error: modelError } = await testUser.client
        .from('models')
        .insert({
          ...TEST_CONFIG.testModel,
          name: `${TEST_CONFIG.testModel.name} ${i + 1}`,
          user_id: userId
        })
        .select()
        .single();
      
      if (modelError) {
        throw new Error(`Failed to create model for user ${i + 1}: ${modelError.message}`);
      }
      
      // Create a test sample for this model
      const { data: sampleData, error: sampleError } = await testUser.client
        .from('samples')
        .insert({
          ...TEST_CONFIG.testSample,
          modelId: modelData.id
        })
        .select()
        .single();
      
      if (sampleError) {
        throw new Error(`Failed to create sample for user ${i + 1}: ${sampleError.message}`);
      }
      
      // Create a test image for this model using service role (simulating webhook)
      const { data: imageData, error: imageError } = await this.serviceClient
        .from('images')
        .insert({
          ...TEST_CONFIG.testImage,
          modelId: modelData.id
        })
        .select()
        .single();
      
      if (imageError) {
        throw new Error(`Failed to create image for user ${i + 1}: ${imageError.message}`);
      }
      
      // Store test data references
      this.testData[`user${i + 1}`] = {
        credits: creditsData,
        model: modelData,
        sample: sampleData,
        image: imageData
      };
    }
    
    this.log('Test data setup complete');
  }

  async testCreditsRLS() {
    const user1 = this.testUsers[0];
    const user2 = this.testUsers[1];
    const user1Credits = this.testData.user1.credits;
    const user2Credits = this.testData.user2.credits;

    // Test 1: User can read their own credits
    await this.runTest('User can read own credits', async () => {
      const { data, error } = await user1.client
        .from('credits')
        .select('*')
        .eq('user_id', user1.user.id);
      
      if (error) throw new Error(`Failed to read own credits: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No credits found for user');
      if (data[0].id !== user1Credits.id) throw new Error('Wrong credits returned');
    });

    // Test 2: User cannot read other user's credits
    await this.runTest('User cannot read other user credits', async () => {
      const { data, error } = await user1.client
        .from('credits')
        .select('*')
        .eq('user_id', user2.user.id);
      
      // Should return empty array due to RLS, not an error
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to read other user credits');
    });

    // Test 3: User can update their own credits
    await this.runTest('User can update own credits', async () => {
      const { data, error } = await user1.client
        .from('credits')
        .update({ credits: 15 })
        .eq('id', user1Credits.id)
        .select();
      
      if (error) throw new Error(`Failed to update own credits: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from update');
      if (data[0].credits !== 15) throw new Error('Credits not updated correctly');
    });

    // Test 4: User cannot update other user's credits
    await this.runTest('User cannot update other user credits', async () => {
      const { data, error } = await user1.client
        .from('credits')
        .update({ credits: 999 })
        .eq('id', user2Credits.id)
        .select();
      
      // Should return empty array due to RLS
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to update other user credits');
    });
  }

  async testModelsRLS() {
    const user1 = this.testUsers[0];
    const user2 = this.testUsers[1];
    const user1Model = this.testData.user1.model;
    const user2Model = this.testData.user2.model;

    // Test 1: User can read their own models
    await this.runTest('User can read own models', async () => {
      const { data, error } = await user1.client
        .from('models')
        .select('*')
        .eq('user_id', user1.user.id);
      
      if (error) throw new Error(`Failed to read own models: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No models found for user');
      if (!data.some(m => m.id === user1Model.id)) throw new Error('User model not found');
    });

    // Test 2: User cannot read other user's models
    await this.runTest('User cannot read other user models', async () => {
      const { data, error } = await user1.client
        .from('models')
        .select('*')
        .eq('user_id', user2.user.id);
      
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to read other user models');
    });

    // Test 3: User can update their own models
    await this.runTest('User can update own models', async () => {
      const { data, error } = await user1.client
        .from('models')
        .update({ status: 'completed' })
        .eq('id', user1Model.id)
        .select();
      
      if (error) throw new Error(`Failed to update own model: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from update');
      if (data[0].status !== 'completed') throw new Error('Model not updated correctly');
    });

    // Test 4: User cannot update other user's models
    await this.runTest('User cannot update other user models', async () => {
      const { data, error } = await user1.client
        .from('models')
        .update({ status: 'hacked' })
        .eq('id', user2Model.id)
        .select();
      
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to update other user model');
    });

    // Test 5: User can delete their own models
    await this.runTest('User can delete own models', async () => {
      // Create a temporary model to delete
      const { data: tempModel, error: createError } = await user1.client
        .from('models')
        .insert({
          name: 'Temp Model for Delete Test',
          type: 'headshot',
          user_id: user1.user.id
        })
        .select()
        .single();
      
      if (createError) throw new Error(`Failed to create temp model: ${createError.message}`);
      
      const { data, error } = await user1.client
        .from('models')
        .delete()
        .eq('id', tempModel.id)
        .select();
      
      if (error) throw new Error(`Failed to delete own model: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from delete');
    });
  }

  async testSamplesRLS() {
    const user1 = this.testUsers[0];
    const user2 = this.testUsers[1];
    const user1Sample = this.testData.user1.sample;
    const user2Sample = this.testData.user2.sample;

    // Test 1: User can read samples for their own models
    await this.runTest('User can read samples for own models', async () => {
      const { data, error } = await user1.client
        .from('samples')
        .select('*')
        .eq('modelId', this.testData.user1.model.id);
      
      if (error) throw new Error(`Failed to read own samples: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No samples found for user model');
      if (!data.some(s => s.id === user1Sample.id)) throw new Error('User sample not found');
    });

    // Test 2: User cannot read samples for other user's models
    await this.runTest('User cannot read samples for other user models', async () => {
      const { data, error } = await user1.client
        .from('samples')
        .select('*')
        .eq('modelId', this.testData.user2.model.id);
      
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to read other user samples');
    });

    // Test 3: User can update samples for their own models
    await this.runTest('User can update samples for own models', async () => {
      const { data, error } = await user1.client
        .from('samples')
        .update({ uri: 'https://example.com/updated-sample.jpg' })
        .eq('id', user1Sample.id)
        .select();
      
      if (error) throw new Error(`Failed to update own sample: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from update');
    });

    // Test 4: User cannot update samples for other user's models
    await this.runTest('User cannot update samples for other user models', async () => {
      const { data, error } = await user1.client
        .from('samples')
        .update({ uri: 'https://example.com/hacked-sample.jpg' })
        .eq('id', user2Sample.id)
        .select();
      
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to update other user sample');
    });
  }

  async testImagesRLS() {
    const user1 = this.testUsers[0];
    const user2 = this.testUsers[1];
    const user1Image = this.testData.user1.image;
    const user2Image = this.testData.user2.image;

    // Test 1: User can read images for their own models
    await this.runTest('User can read images for own models', async () => {
      const { data, error } = await user1.client
        .from('images')
        .select('*')
        .eq('modelId', this.testData.user1.model.id);
      
      if (error) throw new Error(`Failed to read own images: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No images found for user model');
      if (!data.some(i => i.id === user1Image.id)) throw new Error('User image not found');
    });

    // Test 2: User cannot read images for other user's models
    await this.runTest('User cannot read images for other user models', async () => {
      const { data, error } = await user1.client
        .from('images')
        .select('*')
        .eq('modelId', this.testData.user2.model.id);
      
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to read other user images');
    });

    // Test 3: User can update images for their own models
    await this.runTest('User can update images for own models', async () => {
      const { data, error } = await user1.client
        .from('images')
        .update({ uri: 'https://example.com/updated-image.jpg' })
        .eq('id', user1Image.id)
        .select();
      
      if (error) throw new Error(`Failed to update own image: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from update');
    });

    // Test 4: User cannot update images for other user's models
    await this.runTest('User cannot update images for other user models', async () => {
      const { data, error } = await user1.client
        .from('images')
        .update({ uri: 'https://example.com/hacked-image.jpg' })
        .eq('id', user2Image.id)
        .select();
      
      if (error) throw new Error(`Unexpected error: ${error.message}`);
      if (data && data.length > 0) throw new Error('User was able to update other user image');
    });
  }

  async testServiceRoleAccess() {
    const user1Credits = this.testData.user1.credits;
    const user1Model = this.testData.user1.model;
    const user1Sample = this.testData.user1.sample;
    const user1Image = this.testData.user1.image;

    // Test 1: Service role can read all credits
    await this.runTest('Service role can read all credits', async () => {
      const { data, error } = await this.serviceClient
        .from('credits')
        .select('*')
        .limit(10);
      
      if (error) throw new Error(`Service role failed to read credits: ${error.message}`);
      if (!data || data.length === 0) throw new Error('Service role found no credits');
    });

    // Test 2: Service role can update any credits
    await this.runTest('Service role can update any credits', async () => {
      const { data, error } = await this.serviceClient
        .from('credits')
        .update({ credits: 20 })
        .eq('id', user1Credits.id)
        .select();
      
      if (error) throw new Error(`Service role failed to update credits: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from service role update');
      if (data[0].credits !== 20) throw new Error('Credits not updated correctly by service role');
    });

    // Test 3: Service role can update any models
    await this.runTest('Service role can update any models', async () => {
      const { data, error } = await this.serviceClient
        .from('models')
        .update({ status: 'service_updated' })
        .eq('id', user1Model.id)
        .select();
      
      if (error) throw new Error(`Service role failed to update model: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from service role update');
      if (data[0].status !== 'service_updated') throw new Error('Model not updated correctly by service role');
    });

    // Test 4: Service role can insert images
    await this.runTest('Service role can insert images', async () => {
      const { data, error } = await this.serviceClient
        .from('images')
        .insert({
          uri: 'https://example.com/service-generated.jpg',
          modelId: user1Model.id
        })
        .select();
      
      if (error) throw new Error(`Service role failed to insert image: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No data returned from service role insert');
    });

    // Test 5: Service role can perform operations across all tables
    await this.runTest('Service role has full access across tables', async () => {
      // Read from all tables
      const [creditsResult, modelsResult, samplesResult, imagesResult] = await Promise.all([
        this.serviceClient.from('credits').select('count', { count: 'exact', head: true }),
        this.serviceClient.from('models').select('count', { count: 'exact', head: true }),
        this.serviceClient.from('samples').select('count', { count: 'exact', head: true }),
        this.serviceClient.from('images').select('count', { count: 'exact', head: true })
      ]);
      
      if (creditsResult.error) throw new Error(`Service role failed to count credits: ${creditsResult.error.message}`);
      if (modelsResult.error) throw new Error(`Service role failed to count models: ${modelsResult.error.message}`);
      if (samplesResult.error) throw new Error(`Service role failed to count samples: ${samplesResult.error.message}`);
      if (imagesResult.error) throw new Error(`Service role failed to count images: ${imagesResult.error.message}`);
    });
  }

  async cleanup() {
    this.log('Cleaning up test data...');
    
    try {
      // Clean up test data using service role
      for (let i = 1; i <= this.testUsers.length; i++) {
        const userData = this.testData[`user${i}`];
        if (userData) {
          // Delete in reverse order of dependencies
          if (userData.image) {
            await this.serviceClient.from('images').delete().eq('id', userData.image.id);
          }
          if (userData.sample) {
            await this.serviceClient.from('samples').delete().eq('id', userData.sample.id);
          }
          if (userData.model) {
            await this.serviceClient.from('models').delete().eq('id', userData.model.id);
          }
          if (userData.credits) {
            await this.serviceClient.from('credits').delete().eq('id', userData.credits.id);
          }
        }
      }
      
      // Sign out all test users
      for (const testUser of this.testUsers) {
        await testUser.client.auth.signOut();
      }
      
      // Delete test users using service role
      for (const testUser of this.testUsers) {
        try {
          await this.serviceClient.auth.admin.deleteUser(testUser.user.id);
          this.log(`Deleted test user: ${testUser.email}`);
        } catch (error) {
          this.log(`Failed to delete test user ${testUser.email}: ${error.message}`, 'error');
        }
      }
      
      this.log('Cleanup completed');
    } catch (error) {
      this.log(`Cleanup error: ${error.message}`, 'error');
    }
  }

  async run() {
    try {
      this.log('Starting RLS Security Test Suite...');
      
      // Setup
      await this.setupTestUsers();
      await this.setupTestData();
      
      // Run all RLS tests
      await this.testCreditsRLS();
      await this.testModelsRLS();
      await this.testSamplesRLS();
      await this.testImagesRLS();
      await this.testServiceRoleAccess();
      
      // Cleanup
      await this.cleanup();
      
      // Report results
      this.log('\n=== RLS TEST RESULTS ===');
      const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
      const failedTests = this.testResults.filter(r => r.status === 'FAIL').length;
      
      this.log(`Total tests: ${this.testResults.length}`);
      this.log(`Passed: ${passedTests}`, 'success');
      this.log(`Failed: ${failedTests}`, failedTests > 0 ? 'error' : 'success');
      
      if (failedTests > 0) {
        this.log('\nFailed tests:');
        this.testResults
          .filter(r => r.status === 'FAIL')
          .forEach(test => {
            this.log(`  - ${test.name}: ${test.error}`, 'error');
          });
      }
      
      this.log('\n=== RLS SECURITY VERIFICATION COMPLETE ===');
      
      if (failedTests > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const testSuite = new RLSTestSuite();
  testSuite.run();
}

module.exports = RLSTestSuite;