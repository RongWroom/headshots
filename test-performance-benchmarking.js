/**
 * Test script for Training Performance Benchmarking System
 * Tests automated benchmarking, regression detection, parameter optimization, and reporting
 */

const API_BASE = 'http://localhost:3000/api';

// Test configuration
const TEST_CONFIG = {
  benchmark: {
    name: 'Test Benchmark - High Quality',
    description: 'Test benchmark for high quality training configuration',
    provider: 'runpod',
    training_config: {
      resolution: 1024,
      max_train_steps: 1500,
      lora_rank: 64,
      learning_rate: 0.0001,
      train_batch_size: 2,
      gradient_accumulation: 4,
      mixed_precision: 'fp16',
      use_xformers: true
    },
    test_images: [
      'https://example.com/test1.jpg',
      'https://example.com/test2.jpg',
      'https://example.com/test3.jpg',
      'https://example.com/test4.jpg',
      'https://example.com/test5.jpg'
    ],
    expected_metrics: {
      max_training_time: 1800000, // 30 minutes
      min_quality_score: 0.85,
      max_cost: 3.0,
      min_success_rate: 0.95
    }
  }
};

// Utility functions
function logTest(testName, status, details = '') {
  const timestamp = new Date().toISOString();
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`[${timestamp}] ${statusIcon} ${testName}${details ? ': ' + details : ''}`);
}

function logSection(sectionName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ${sectionName}`);
  console.log(`${'='.repeat(60)}`);
}

async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  const data = await response.json();
  return { response, data };
}

// Test functions
async function testCreateBenchmark() {
  logSection('CREATE PERFORMANCE BENCHMARK');
  
  try {
    const { response, data } = await makeRequest('/training/performance-benchmarking', {
      method: 'POST',
      body: JSON.stringify(TEST_CONFIG.benchmark)
    });

    if (response.ok && data.success) {
      logTest('Create benchmark', 'PASS', `Created benchmark: ${data.data.id}`);
      return data.data;
    } else {
      logTest('Create benchmark', 'FAIL', data.error || 'Unknown error');
      return null;
    }
  } catch (error) {
    logTest('Create benchmark', 'FAIL', error.message);
    return null;
  }
}

async function testCreateBenchmarkValidation() {
  logSection('BENCHMARK VALIDATION TESTS');
  
  // Test missing required fields
  const invalidConfigs = [
    { ...TEST_CONFIG.benchmark, name: undefined },
    { ...TEST_CONFIG.benchmark, provider: undefined },
    { ...TEST_CONFIG.benchmark, training_config: undefined },
    { ...TEST_CONFIG.benchmark, test_images: undefined },
    { ...TEST_CONFIG.benchmark, expected_metrics: undefined }
  ];

  for (let i = 0; i < invalidConfigs.length; i++) {
    try {
      const { response, data } = await makeRequest('/training/performance-benchmarking', {
        method: 'POST',
        body: JSON.stringify(invalidConfigs[i])
      });

      if (response.status === 400 && !data.success) {
        logTest(`Validation test ${i + 1}`, 'PASS', 'Correctly rejected invalid config');
      } else {
        logTest(`Validation test ${i + 1}`, 'FAIL', 'Should have rejected invalid config');
      }
    } catch (error) {
      logTest(`Validation test ${i + 1}`, 'FAIL', error.message);
    }
  }

  // Test invalid training config
  try {
    const invalidTrainingConfig = {
      ...TEST_CONFIG.benchmark,
      training_config: {
        resolution: 1024,
        // Missing required fields
      }
    };

    const { response, data } = await makeRequest('/training/performance-benchmarking', {
      method: 'POST',
      body: JSON.stringify(invalidTrainingConfig)
    });

    if (response.status === 400 && !data.success) {
      logTest('Training config validation', 'PASS', 'Correctly rejected incomplete training config');
    } else {
      logTest('Training config validation', 'FAIL', 'Should have rejected incomplete training config');
    }
  } catch (error) {
    logTest('Training config validation', 'FAIL', error.message);
  }
}

async function testRunAutomatedBenchmarking() {
  logSection('AUTOMATED BENCHMARKING');
  
  try {
    logTest('Starting automated benchmarking', 'RUNNING');
    
    const { response, data } = await makeRequest('/training/performance-benchmarking?action=run');

    if (response.ok && data.success) {
      logTest('Run automated benchmarking', 'PASS', `Completed ${data.data.length} benchmark runs`);
      
      // Analyze results
      const successfulRuns = data.data.filter(result => result.success);
      const failedRuns = data.data.filter(result => !result.success);
      const regressionsDetected = data.data.filter(result => result.regression_detected);
      
      logTest('Benchmark analysis', 'INFO', 
        `Successful: ${successfulRuns.length}, Failed: ${failedRuns.length}, Regressions: ${regressionsDetected.length}`);
      
      return data.data;
    } else {
      logTest('Run automated benchmarking', 'FAIL', data.error || 'Unknown error');
      return [];
    }
  } catch (error) {
    logTest('Run automated benchmarking', 'FAIL', error.message);
    return [];
  }
}

async function testParameterOptimization() {
  logSection('PARAMETER OPTIMIZATION');
  
  const providers = ['runpod', 'fal', 'replicate'];
  const targets = ['quality', 'speed', 'cost', 'balanced'];
  
  for (const provider of providers) {
    for (const target of targets) {
      try {
        const { response, data } = await makeRequest(
          `/training/performance-optimization?provider=${provider}&target=${target}`
        );

        if (response.ok && data.success) {
          logTest(`${provider} - ${target} optimization`, 'PASS', 
            `Generated ${data.data.length} optimizations`);
          
          // Test applying an optimization if any were generated
          if (data.data.length > 0) {
            const optimization = data.data[0];
            const { response: applyResponse, data: applyData } = await makeRequest(
              '/training/performance-optimization',
              {
                method: 'POST',
                body: JSON.stringify({
                  optimizationId: optimization.id,
                  notes: `Test application of ${target} optimization for ${provider}`
                })
              }
            );

            if (applyResponse.ok && applyData.success) {
              logTest(`Apply ${provider} - ${target} optimization`, 'PASS', 
                `Applied optimization with ${applyData.data.results.success ? 'success' : 'failure'}`);
            } else {
              logTest(`Apply ${provider} - ${target} optimization`, 'FAIL', 
                applyData.error || 'Unknown error');
            }
          }
        } else {
          logTest(`${provider} - ${target} optimization`, 'FAIL', data.error || 'Unknown error');
        }
      } catch (error) {
        logTest(`${provider} - ${target} optimization`, 'FAIL', error.message);
      }
    }
  }
}

async function testParameterOptimizationValidation() {
  logSection('PARAMETER OPTIMIZATION VALIDATION');
  
  // Test missing provider
  try {
    const { response, data } = await makeRequest('/training/performance-optimization');
    
    if (response.status === 400 && !data.success) {
      logTest('Missing provider validation', 'PASS', 'Correctly rejected missing provider');
    } else {
      logTest('Missing provider validation', 'FAIL', 'Should have rejected missing provider');
    }
  } catch (error) {
    logTest('Missing provider validation', 'FAIL', error.message);
  }

  // Test invalid target
  try {
    const { response, data } = await makeRequest(
      '/training/performance-optimization?provider=runpod&target=invalid'
    );
    
    if (response.status === 400 && !data.success) {
      logTest('Invalid target validation', 'PASS', 'Correctly rejected invalid target');
    } else {
      logTest('Invalid target validation', 'FAIL', 'Should have rejected invalid target');
    }
  } catch (error) {
    logTest('Invalid target validation', 'FAIL', error.message);
  }

  // Test missing optimization ID for application
  try {
    const { response, data } = await makeRequest('/training/performance-optimization', {
      method: 'POST',
      body: JSON.stringify({ notes: 'Test without ID' })
    });
    
    if (response.status === 400 && !data.success) {
      logTest('Missing optimization ID validation', 'PASS', 'Correctly rejected missing optimization ID');
    } else {
      logTest('Missing optimization ID validation', 'FAIL', 'Should have rejected missing optimization ID');
    }
  } catch (error) {
    logTest('Missing optimization ID validation', 'FAIL', error.message);
  }
}

async function testPerformanceReports() {
  logSection('PERFORMANCE REPORTS');
  
  // Test default report generation (last 30 days)
  try {
    const { response, data } = await makeRequest('/training/performance-reports');

    if (response.ok && data.success) {
      logTest('Generate default performance report', 'PASS', 
        `Generated report for period: ${data.data.period}`);
      
      // Validate report structure
      const report = data.data;
      const hasRequiredSections = report.provider_comparisons && 
                                 report.configuration_analysis && 
                                 report.trend_analysis && 
                                 report.recommendations;
      
      if (hasRequiredSections) {
        logTest('Report structure validation', 'PASS', 
          `Report contains all required sections`);
      } else {
        logTest('Report structure validation', 'FAIL', 
          'Report missing required sections');
      }
    } else {
      logTest('Generate default performance report', 'FAIL', data.error || 'Unknown error');
    }
  } catch (error) {
    logTest('Generate default performance report', 'FAIL', error.message);
  }

  // Test custom date range report
  try {
    const startDate = '2024-09-01';
    const endDate = '2024-09-28';
    
    const { response, data } = await makeRequest(
      `/training/performance-reports?startDate=${startDate}&endDate=${endDate}`
    );

    if (response.ok && data.success) {
      logTest('Generate custom date range report', 'PASS', 
        `Generated report for ${startDate} to ${endDate}`);
    } else {
      logTest('Generate custom date range report', 'FAIL', data.error || 'Unknown error');
    }
  } catch (error) {
    logTest('Generate custom date range report', 'FAIL', error.message);
  }
}

async function testPerformanceReportsValidation() {
  logSection('PERFORMANCE REPORTS VALIDATION');
  
  // Test invalid date format
  try {
    const { response, data } = await makeRequest(
      '/training/performance-reports?startDate=invalid-date&endDate=2024-09-28'
    );
    
    if (response.status === 400 && !data.success) {
      logTest('Invalid date format validation', 'PASS', 'Correctly rejected invalid date format');
    } else {
      logTest('Invalid date format validation', 'FAIL', 'Should have rejected invalid date format');
    }
  } catch (error) {
    logTest('Invalid date format validation', 'FAIL', error.message);
  }

  // Test invalid date range (start after end)
  try {
    const { response, data } = await makeRequest(
      '/training/performance-reports?startDate=2024-09-28&endDate=2024-09-01'
    );
    
    if (response.status === 400 && !data.success) {
      logTest('Invalid date range validation', 'PASS', 'Correctly rejected invalid date range');
    } else {
      logTest('Invalid date range validation', 'FAIL', 'Should have rejected invalid date range');
    }
  } catch (error) {
    logTest('Invalid date range validation', 'FAIL', error.message);
  }
}

async function testScheduledReports() {
  logSection('SCHEDULED REPORTS');
  
  const scheduledReportConfig = {
    frequency: 'weekly',
    recipients: ['admin@example.com', 'dev@example.com'],
    reportTypes: ['provider_comparison', 'regression_alerts'],
    enabled: true
  };

  try {
    const { response, data } = await makeRequest('/training/performance-reports', {
      method: 'POST',
      body: JSON.stringify(scheduledReportConfig)
    });

    if (response.ok && data.success) {
      logTest('Schedule performance reports', 'PASS', 
        `Scheduled ${data.data.frequency} reports for ${data.data.recipients.length} recipients`);
    } else {
      logTest('Schedule performance reports', 'FAIL', data.error || 'Unknown error');
    }
  } catch (error) {
    logTest('Schedule performance reports', 'FAIL', error.message);
  }

  // Test validation for scheduled reports
  const invalidConfigs = [
    { ...scheduledReportConfig, frequency: 'invalid' },
    { ...scheduledReportConfig, recipients: [] },
    { ...scheduledReportConfig, recipients: ['invalid-email'] },
    { ...scheduledReportConfig, reportTypes: ['invalid_type'] }
  ];

  for (let i = 0; i < invalidConfigs.length; i++) {
    try {
      const { response, data } = await makeRequest('/training/performance-reports', {
        method: 'POST',
        body: JSON.stringify(invalidConfigs[i])
      });

      if (response.status === 400 && !data.success) {
        logTest(`Scheduled report validation ${i + 1}`, 'PASS', 'Correctly rejected invalid config');
      } else {
        logTest(`Scheduled report validation ${i + 1}`, 'FAIL', 'Should have rejected invalid config');
      }
    } catch (error) {
      logTest(`Scheduled report validation ${i + 1}`, 'FAIL', error.message);
    }
  }
}

async function testRegressionAlerts() {
  logSection('REGRESSION ALERTS');
  
  // Test getting regression alerts
  try {
    const { response, data } = await makeRequest('/training/regression-alerts');

    if (response.ok && data.success) {
      logTest('Get regression alerts', 'PASS', 
        `Retrieved ${data.data.alerts.length} alerts`);
      
      // Test filtering by severity
      const severities = ['low', 'medium', 'high', 'critical'];
      for (const severity of severities) {
        const { response: filterResponse, data: filterData } = await makeRequest(
          `/training/regression-alerts?severity=${severity}`
        );
        
        if (filterResponse.ok && filterData.success) {
          logTest(`Filter alerts by ${severity} severity`, 'PASS', 
            `Found ${filterData.data.alerts.length} ${severity} alerts`);
        } else {
          logTest(`Filter alerts by ${severity} severity`, 'FAIL', 
            filterData.error || 'Unknown error');
        }
      }
    } else {
      logTest('Get regression alerts', 'FAIL', data.error || 'Unknown error');
    }
  } catch (error) {
    logTest('Get regression alerts', 'FAIL', error.message);
  }

  // Test alert resolution (mock alert ID)
  try {
    const mockAlertId = 'test_alert_123';
    const { response, data } = await makeRequest('/training/regression-alerts', {
      method: 'POST',
      body: JSON.stringify({
        alertId: mockAlertId,
        action: 'resolve',
        resolutionNotes: 'Test resolution'
      })
    });

    // This will likely fail since the alert doesn't exist, but we're testing the validation
    if (response.status === 404) {
      logTest('Resolve regression alert', 'PASS', 'Correctly handled non-existent alert');
    } else if (response.ok && data.success) {
      logTest('Resolve regression alert', 'PASS', 'Successfully resolved alert');
    } else {
      logTest('Resolve regression alert', 'INFO', 'Expected behavior for test alert');
    }
  } catch (error) {
    logTest('Resolve regression alert', 'FAIL', error.message);
  }
}

async function testRegressionAlertsValidation() {
  logSection('REGRESSION ALERTS VALIDATION');
  
  // Test invalid severity filter
  try {
    const { response, data } = await makeRequest('/training/regression-alerts?severity=invalid');
    
    if (response.status === 400 && !data.success) {
      logTest('Invalid severity filter validation', 'PASS', 'Correctly rejected invalid severity');
    } else {
      logTest('Invalid severity filter validation', 'FAIL', 'Should have rejected invalid severity');
    }
  } catch (error) {
    logTest('Invalid severity filter validation', 'FAIL', error.message);
  }

  // Test missing alert ID for resolution
  try {
    const { response, data } = await makeRequest('/training/regression-alerts', {
      method: 'POST',
      body: JSON.stringify({ action: 'resolve' })
    });
    
    if (response.status === 400 && !data.success) {
      logTest('Missing alert ID validation', 'PASS', 'Correctly rejected missing alert ID');
    } else {
      logTest('Missing alert ID validation', 'FAIL', 'Should have rejected missing alert ID');
    }
  } catch (error) {
    logTest('Missing alert ID validation', 'FAIL', error.message);
  }

  // Test invalid action
  try {
    const { response, data } = await makeRequest('/training/regression-alerts', {
      method: 'POST',
      body: JSON.stringify({ alertId: 'test', action: 'invalid' })
    });
    
    if (response.status === 400 && !data.success) {
      logTest('Invalid action validation', 'PASS', 'Correctly rejected invalid action');
    } else {
      logTest('Invalid action validation', 'FAIL', 'Should have rejected invalid action');
    }
  } catch (error) {
    logTest('Invalid action validation', 'FAIL', error.message);
  }
}

async function testEndToEndWorkflow() {
  logSection('END-TO-END WORKFLOW TEST');
  
  try {
    // 1. Create a benchmark
    logTest('Step 1: Create benchmark', 'RUNNING');
    const benchmark = await testCreateBenchmark();
    
    if (!benchmark) {
      logTest('End-to-end workflow', 'FAIL', 'Failed to create benchmark');
      return;
    }

    // 2. Run benchmarking
    logTest('Step 2: Run benchmarking', 'RUNNING');
    const results = await testRunAutomatedBenchmarking();
    
    if (results.length === 0) {
      logTest('End-to-end workflow', 'FAIL', 'No benchmark results generated');
      return;
    }

    // 3. Generate optimizations
    logTest('Step 3: Generate optimizations', 'RUNNING');
    const { response: optResponse, data: optData } = await makeRequest(
      '/training/performance-optimization?provider=runpod&target=balanced'
    );
    
    if (!optResponse.ok || !optData.success) {
      logTest('End-to-end workflow', 'FAIL', 'Failed to generate optimizations');
      return;
    }

    // 4. Generate performance report
    logTest('Step 4: Generate performance report', 'RUNNING');
    const { response: reportResponse, data: reportData } = await makeRequest(
      '/training/performance-reports'
    );
    
    if (!reportResponse.ok || !reportData.success) {
      logTest('End-to-end workflow', 'FAIL', 'Failed to generate performance report');
      return;
    }

    // 5. Check for regression alerts
    logTest('Step 5: Check regression alerts', 'RUNNING');
    const { response: alertResponse, data: alertData } = await makeRequest(
      '/training/regression-alerts'
    );
    
    if (!alertResponse.ok || !alertData.success) {
      logTest('End-to-end workflow', 'FAIL', 'Failed to check regression alerts');
      return;
    }

    logTest('End-to-end workflow', 'PASS', 'All steps completed successfully');
    
  } catch (error) {
    logTest('End-to-end workflow', 'FAIL', error.message);
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting Training Performance Benchmarking System Tests');
  console.log(`📅 Test run started at: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  
  try {
    // Core functionality tests
    await testCreateBenchmark();
    await testCreateBenchmarkValidation();
    await testRunAutomatedBenchmarking();
    
    // Parameter optimization tests
    await testParameterOptimization();
    await testParameterOptimizationValidation();
    
    // Performance reports tests
    await testPerformanceReports();
    await testPerformanceReportsValidation();
    await testScheduledReports();
    
    // Regression alerts tests
    await testRegressionAlerts();
    await testRegressionAlertsValidation();
    
    // End-to-end workflow test
    await testEndToEndWorkflow();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  logSection('TEST SUMMARY');
  console.log(`⏱️  Total test duration: ${duration} seconds`);
  console.log(`📊 Test completed at: ${new Date().toISOString()}`);
  console.log('\n✨ Training Performance Benchmarking System testing complete!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testCreateBenchmark,
  testRunAutomatedBenchmarking,
  testParameterOptimization,
  testPerformanceReports,
  testRegressionAlerts
};