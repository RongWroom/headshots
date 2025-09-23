/**
 * Test script for cost tracking functionality
 * Tests cost estimation, recording, and budget alerts
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Test user ID (replace with actual test user)
const TEST_USER_ID = 'test-user-123';

async function testCostEstimation() {
  console.log('\n=== Testing Cost Estimation ===');
  
  const estimateRequest = {
    serviceProvider: 'runpod',
    imageCount: 15,
    trainingParameters: {
      resolution: 1024,
      maxTrainSteps: 1500,
      loraRank: 64,
      trainBatchSize: 1,
      gpuType: 'RTX 4090'
    },
    userId: TEST_USER_ID
  };

  try {
    const response = await fetch(`${API_BASE}/api/training/cost-estimate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(estimateRequest)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Cost estimation successful');
      console.log(`   Estimated cost: $${result.estimate.estimatedCost}`);
      console.log(`   Estimated time: ${result.estimate.estimatedTrainingTimeMinutes} minutes`);
      console.log(`   Confidence: ${result.estimate.confidence}`);
      console.log(`   Cost breakdown:`, result.estimate.costBreakdown);
      console.log(`   Recommendations:`, result.estimate.recommendations);
      return result.estimate.id;
    } else {
      console.log('❌ Cost estimation failed:', result.error);
      console.log('   Details:', result.details);
      return null;
    }
  } catch (error) {
    console.log('❌ Cost estimation request failed:', error.message);
    return null;
  }
}

async function testCostHistory() {
  console.log('\n=== Testing Cost History ===');
  
  try {
    const response = await fetch(`${API_BASE}/api/training/cost-estimate?userId=${TEST_USER_ID}&days=30`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Cost history retrieved successfully');
      console.log(`   Total cost (30 days): $${result.summary.totalCost}`);
      console.log(`   Average cost per job: $${result.summary.averageCost}`);
      console.log(`   Total jobs: ${result.summary.totalJobs}`);
      console.log(`   Provider breakdown:`, result.summary.providerBreakdown);
      
      if (result.history.length > 0) {
        console.log(`   Recent jobs:`);
        result.history.slice(0, 3).forEach((job, index) => {
          console.log(`     ${index + 1}. ${job.trainingId}: $${job.totalCost} (${job.status})`);
        });
      }
    } else {
      console.log('❌ Cost history failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Cost history request failed:', error.message);
  }
}

async function testBudgetAlerts() {
  console.log('\n=== Testing Budget Alerts ===');
  
  // Create a budget alert
  const alertRequest = {
    userId: TEST_USER_ID,
    alertType: 'monthly',
    thresholdAmount: 50.00,
    currency: 'USD',
    isActive: true,
    notificationEmail: 'test@example.com'
  };

  try {
    const createResponse = await fetch(`${API_BASE}/api/training/budget-alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alertRequest)
    });

    const createResult = await createResponse.json();
    
    if (createResponse.ok) {
      console.log('✅ Budget alert created successfully');
      console.log(`   Alert ID: ${createResult.alert.id}`);
      console.log(`   Type: ${createResult.alert.alertType}`);
      console.log(`   Threshold: $${createResult.alert.thresholdAmount}`);
      
      // Get budget status
      const statusResponse = await fetch(`${API_BASE}/api/training/budget-alerts?userId=${TEST_USER_ID}`);
      const statusResult = await statusResponse.json();
      
      if (statusResponse.ok) {
        console.log('✅ Budget status retrieved successfully');
        console.log(`   Active alerts: ${statusResult.alerts.filter(a => a.isActive).length}`);
        console.log(`   Budget statuses:`, statusResult.budgetStatuses);
        
        // Update the alert
        const updateResponse = await fetch(`${API_BASE}/api/training/budget-alerts`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            alertId: createResult.alert.id,
            thresholdAmount: 75.00,
            isActive: false
          })
        });

        const updateResult = await updateResponse.json();
        
        if (updateResponse.ok) {
          console.log('✅ Budget alert updated successfully');
          console.log(`   New threshold: $${updateResult.alert.thresholdAmount}`);
          console.log(`   Active: ${updateResult.alert.isActive}`);
        } else {
          console.log('❌ Budget alert update failed:', updateResult.error);
        }
        
        // Clean up - delete the test alert
        const deleteResponse = await fetch(`${API_BASE}/api/training/budget-alerts?alertId=${createResult.alert.id}`, {
          method: 'DELETE'
        });

        if (deleteResponse.ok) {
          console.log('✅ Test budget alert cleaned up successfully');
        }
        
      } else {
        console.log('❌ Budget status failed:', statusResult.error);
      }
    } else {
      console.log('❌ Budget alert creation failed:', createResult.error);
      console.log('   Details:', createResult.details);
    }
  } catch (error) {
    console.log('❌ Budget alert request failed:', error.message);
  }
}

async function testProviderComparison() {
  console.log('\n=== Testing Provider Cost Comparison ===');
  
  const testParams = {
    imageCount: 12,
    trainingParameters: {
      resolution: 1024,
      maxTrainSteps: 1000,
      loraRank: 64,
      trainBatchSize: 1
    },
    userId: TEST_USER_ID
  };

  const providers = ['runpod', 'fal', 'replicate'];
  const estimates = {};

  for (const provider of providers) {
    try {
      const response = await fetch(`${API_BASE}/api/training/cost-estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...testParams,
          serviceProvider: provider
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        estimates[provider] = {
          cost: result.estimate.estimatedCost,
          time: result.estimate.estimatedTrainingTimeMinutes,
          confidence: result.estimate.confidence
        };
        console.log(`✅ ${provider}: $${result.estimate.estimatedCost} (${result.estimate.estimatedTrainingTimeMinutes}min, ${result.estimate.confidence} confidence)`);
      } else {
        console.log(`❌ ${provider} estimation failed:`, result.error);
      }
    } catch (error) {
      console.log(`❌ ${provider} request failed:`, error.message);
    }
  }

  // Find the most cost-effective option
  const sortedProviders = Object.entries(estimates)
    .sort(([,a], [,b]) => a.cost - b.cost);

  if (sortedProviders.length > 0) {
    console.log(`\n💡 Most cost-effective: ${sortedProviders[0][0]} at $${sortedProviders[0][1].cost}`);
    console.log(`💡 Fastest: ${Object.entries(estimates).sort(([,a], [,b]) => a.time - b.time)[0][0]} at ${Object.entries(estimates).sort(([,a], [,b]) => a.time - b.time)[0][1].time} minutes`);
  }
}

async function runAllTests() {
  console.log('🧪 Starting Cost Tracking Tests');
  console.log('================================');
  
  await testCostEstimation();
  await testCostHistory();
  await testBudgetAlerts();
  await testProviderComparison();
  
  console.log('\n✨ Cost tracking tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testCostEstimation,
  testCostHistory,
  testBudgetAlerts,
  testProviderComparison,
  runAllTests
};