/**
 * Integration tests for the Quality Assessment System
 * Tests the complete workflow including API endpoints and database operations
 */

const { execSync } = require('child_process');

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TEST_MODEL_ID = 'test-quality-model-' + Date.now();

// Test data
const TEST_GENERATED_IMAGE = 'https://example.com/generated-headshot.jpg';
const TEST_ORIGINAL_IMAGES = [
  'https://example.com/original1.jpg',
  'https://example.com/original2.jpg',
  'https://example.com/original3.jpg'
];

async function runQualityAssessmentIntegrationTests() {
  console.log('🧪 Starting Quality Assessment Integration Tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Helper function to make API requests
  async function makeRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`📡 Making request to: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      const data = await response.json();
      return { response, data };
    } catch (error) {
      console.error(`❌ Request failed: ${error.message}`);
      throw error;
    }
  }

  // Test 1: CLIP Similarity API
  console.log('🔍 Test 1: CLIP Similarity API');
  try {
    const { response, data } = await makeRequest('/api/quality/clip-similarity', {
      method: 'POST',
      body: JSON.stringify({
        generatedImage: TEST_GENERATED_IMAGE,
        originalImages: TEST_ORIGINAL_IMAGES
      })
    });

    if (response.ok && data.similarity !== undefined) {
      console.log(`✅ CLIP similarity calculated: ${data.similarity}`);
      console.log(`   Generated image: ${data.generatedImage}`);
      console.log(`   Original images count: ${data.originalImagesCount}`);
      
      // Validate similarity score is in valid range
      if (data.similarity >= 0 && data.similarity <= 1) {
        console.log('✅ Similarity score is within valid range [0, 1]');
        testsPassed++;
      } else {
        console.log(`❌ Similarity score ${data.similarity} is outside valid range`);
        testsFailed++;
      }
    } else {
      console.log(`❌ CLIP similarity API failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ CLIP similarity test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 2: Face Recognition API
  console.log('🔍 Test 2: Face Recognition API');
  try {
    const { response, data } = await makeRequest('/api/quality/face-recognition', {
      method: 'POST',
      body: JSON.stringify({
        generatedImage: TEST_GENERATED_IMAGE,
        originalImages: TEST_ORIGINAL_IMAGES
      })
    });

    if (response.ok && data.score !== undefined) {
      console.log(`✅ Face recognition score calculated: ${data.score}`);
      console.log(`   Generated image: ${data.generatedImage}`);
      console.log(`   Original images count: ${data.originalImagesCount}`);
      
      // Validate score is in valid range
      if (data.score >= 0 && data.score <= 1) {
        console.log('✅ Face recognition score is within valid range [0, 1]');
        testsPassed++;
      } else {
        console.log(`❌ Face recognition score ${data.score} is outside valid range`);
        testsFailed++;
      }
    } else {
      console.log(`❌ Face recognition API failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Face recognition test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 3: Quality Assessment API
  console.log('🔍 Test 3: Quality Assessment API');
  try {
    const { response, data } = await makeRequest('/api/quality/assess', {
      method: 'POST',
      body: JSON.stringify({
        modelId: TEST_MODEL_ID,
        generatedImageUrl: TEST_GENERATED_IMAGE,
        originalImageUrls: TEST_ORIGINAL_IMAGES
      })
    });

    if (response.ok && data.success) {
      console.log('✅ Quality assessment completed successfully');
      console.log(`   Model ID: ${data.assessment.metrics.modelId}`);
      console.log(`   CLIP Similarity: ${data.assessment.metrics.clipSimilarity.toFixed(3)}`);
      console.log(`   Face Recognition: ${data.assessment.metrics.faceRecognitionScore.toFixed(3)}`);
      console.log(`   Overall Quality: ${data.assessment.metrics.overallQuality.toFixed(3)}`);
      console.log(`   Passes Threshold: ${data.assessment.passesThreshold}`);
      console.log(`   Needs Retraining: ${data.assessment.needsRetraining}`);
      console.log(`   Recommendations: ${data.assessment.recommendations.length}`);
      
      // Validate assessment structure
      const assessment = data.assessment;
      if (assessment.metrics && assessment.passesThreshold !== undefined && 
          assessment.needsRetraining !== undefined && Array.isArray(assessment.recommendations)) {
        console.log('✅ Assessment structure is valid');
        testsPassed++;
      } else {
        console.log('❌ Assessment structure is invalid');
        testsFailed++;
      }
    } else {
      console.log(`❌ Quality assessment API failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Quality assessment test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 4: Quality History Retrieval
  console.log('🔍 Test 4: Quality History Retrieval');
  try {
    // Wait a moment for the previous assessment to be stored
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { response, data } = await makeRequest(`/api/quality/assess?modelId=${TEST_MODEL_ID}`);

    if (response.ok && data.success) {
      console.log('✅ Quality history retrieved successfully');
      console.log(`   Model ID: ${data.modelId}`);
      console.log(`   Quality history entries: ${data.qualityHistory.length}`);
      console.log(`   Retraining needed: ${data.retrainingStatus.needsRetraining}`);
      console.log(`   Retraining reason: ${data.retrainingStatus.reason}`);
      
      // Validate history structure
      if (Array.isArray(data.qualityHistory) && data.retrainingStatus) {
        console.log('✅ Quality history structure is valid');
        testsPassed++;
      } else {
        console.log('❌ Quality history structure is invalid');
        testsFailed++;
      }
    } else {
      console.log(`❌ Quality history retrieval failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Quality history test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 5: Quality Monitoring
  console.log('🔍 Test 5: Quality Monitoring');
  try {
    const { response, data } = await makeRequest('/api/quality/monitor', {
      method: 'POST',
      body: JSON.stringify({
        modelId: TEST_MODEL_ID
      })
    });

    if (response.ok && data.success) {
      console.log('✅ Quality monitoring completed successfully');
      console.log(`   Model ID: ${data.modelId}`);
      console.log(`   Alerts generated: ${data.alertCount}`);
      
      if (data.alerts && Array.isArray(data.alerts)) {
        data.alerts.forEach((alert, index) => {
          console.log(`   Alert ${index + 1}: ${alert.severity} - ${alert.message}`);
        });
        console.log('✅ Quality monitoring structure is valid');
        testsPassed++;
      } else {
        console.log('❌ Quality monitoring structure is invalid');
        testsFailed++;
      }
    } else {
      console.log(`❌ Quality monitoring failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Quality monitoring test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 6: Quality Integration Workflow
  console.log('🔍 Test 6: Quality Integration Workflow');
  try {
    const { response, data } = await makeRequest('/api/training/quality-integration', {
      method: 'POST',
      body: JSON.stringify({
        modelId: TEST_MODEL_ID,
        generatedImageUrl: TEST_GENERATED_IMAGE,
        originalImageUrls: TEST_ORIGINAL_IMAGES,
        config: {
          enableQualityAssessment: true,
          enableQualityMonitoring: true,
          autoRetrainOnLowQuality: false,
          qualityThresholds: {
            clipSimilarityMin: 0.85,
            faceRecognitionMin: 0.85,
            overallQualityMin: 0.85
          }
        }
      })
    });

    if (response.ok && data.success) {
      console.log('✅ Quality integration workflow completed successfully');
      console.log(`   Model ID: ${data.modelId}`);
      console.log(`   Quality assessment: ${data.qualityAssessment ? 'Completed' : 'Skipped'}`);
      console.log(`   Monitoring alerts: ${data.monitoringAlerts.length}`);
      console.log(`   Retraining recommended: ${data.retrainingRecommended}`);
      console.log(`   Actions taken: ${data.actions.length}`);
      
      data.actions.forEach((action, index) => {
        console.log(`   Action ${index + 1}: ${action}`);
      });
      
      // Validate integration structure
      if (data.qualityAssessment && Array.isArray(data.monitoringAlerts) && 
          Array.isArray(data.actions) && data.retrainingRecommended !== undefined) {
        console.log('✅ Quality integration structure is valid');
        testsPassed++;
      } else {
        console.log('❌ Quality integration structure is invalid');
        testsFailed++;
      }
    } else {
      console.log(`❌ Quality integration workflow failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Quality integration test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 7: Quality Report Generation
  console.log('🔍 Test 7: Quality Report Generation');
  try {
    const { response, data } = await makeRequest(`/api/training/quality-integration?modelId=${TEST_MODEL_ID}&action=report`);

    if (response.ok && data.success) {
      console.log('✅ Quality report generated successfully');
      console.log(`   Model ID: ${data.modelId}`);
      console.log(`   Current quality: ${data.report.currentQuality ? 'Available' : 'None'}`);
      console.log(`   Quality history entries: ${data.report.qualityHistory.length}`);
      console.log(`   Active alerts: ${data.report.activeAlerts.length}`);
      console.log(`   Retraining needed: ${data.report.retrainingStatus.needsRetraining}`);
      console.log(`   Recommendations: ${data.report.recommendations.length}`);
      
      data.report.recommendations.forEach((rec, index) => {
        console.log(`   Recommendation ${index + 1}: ${rec}`);
      });
      
      // Validate report structure
      if (data.report.qualityHistory && data.report.activeAlerts && 
          data.report.retrainingStatus && data.report.recommendations) {
        console.log('✅ Quality report structure is valid');
        testsPassed++;
      } else {
        console.log('❌ Quality report structure is invalid');
        testsFailed++;
      }
    } else {
      console.log(`❌ Quality report generation failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Quality report test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 8: Training Image Validation
  console.log('🔍 Test 8: Training Image Validation');
  try {
    const testImageUrls = JSON.stringify(['img1.jpg', 'img2.jpg']); // Too few images
    const { response, data } = await makeRequest(`/api/training/quality-integration?modelId=${TEST_MODEL_ID}&action=validate&imageUrls=${encodeURIComponent(testImageUrls)}`);

    if (response.ok && data.success) {
      console.log('✅ Training image validation completed');
      console.log(`   Validation passed: ${data.validation.isValid}`);
      console.log(`   Issues found: ${data.validation.issues.length}`);
      console.log(`   Recommendations: ${data.validation.recommendations.length}`);
      
      data.validation.issues.forEach((issue, index) => {
        console.log(`   Issue ${index + 1}: ${issue}`);
      });
      
      data.validation.recommendations.forEach((rec, index) => {
        console.log(`   Recommendation ${index + 1}: ${rec}`);
      });
      
      // Validate validation structure
      if (data.validation.isValid !== undefined && Array.isArray(data.validation.issues) && 
          Array.isArray(data.validation.recommendations)) {
        console.log('✅ Training image validation structure is valid');
        testsPassed++;
      } else {
        console.log('❌ Training image validation structure is invalid');
        testsFailed++;
      }
    } else {
      console.log(`❌ Training image validation failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Training image validation test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 9: Quality Monitoring Dashboard
  console.log('🔍 Test 9: Quality Monitoring Dashboard');
  try {
    const { response, data } = await makeRequest('/api/quality/monitor?dashboard=true');

    if (response.ok && data.success) {
      console.log('✅ Quality monitoring dashboard retrieved successfully');
      console.log(`   Total models: ${data.dashboard.totalModels}`);
      console.log(`   Models with alerts: ${data.dashboard.modelsWithAlerts}`);
      console.log(`   Average quality: ${data.dashboard.averageQuality.toFixed(3)}`);
      console.log(`   Recent alerts: ${data.dashboard.recentAlerts.length}`);
      
      // Validate dashboard structure
      if (data.dashboard.totalModels !== undefined && data.dashboard.modelsWithAlerts !== undefined && 
          data.dashboard.averageQuality !== undefined && Array.isArray(data.dashboard.recentAlerts)) {
        console.log('✅ Quality monitoring dashboard structure is valid');
        testsPassed++;
      } else {
        console.log('❌ Quality monitoring dashboard structure is invalid');
        testsFailed++;
      }
    } else {
      console.log(`❌ Quality monitoring dashboard failed: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Quality monitoring dashboard test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Test 10: Error Handling
  console.log('🔍 Test 10: Error Handling');
  try {
    // Test with missing parameters
    const { response, data } = await makeRequest('/api/quality/assess', {
      method: 'POST',
      body: JSON.stringify({}) // Missing required parameters
    });

    if (response.status === 400 && data.error) {
      console.log('✅ Error handling works correctly for missing parameters');
      console.log(`   Error message: ${data.error}`);
      testsPassed++;
    } else {
      console.log(`❌ Error handling failed: Expected 400 status, got ${response.status}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Error handling test failed: ${error.message}`);
    testsFailed++;
  }

  console.log('');

  // Summary
  console.log('📊 Quality Assessment Integration Test Results:');
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

  if (testsFailed === 0) {
    console.log('\n🎉 All Quality Assessment integration tests passed!');
    return true;
  } else {
    console.log('\n⚠️  Some Quality Assessment integration tests failed. Please review the results above.');
    return false;
  }
}

// Run the tests
if (require.main === module) {
  runQualityAssessmentIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runQualityAssessmentIntegrationTests };