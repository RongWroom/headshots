#!/usr/bin/env node

/**
 * RunPod Integration Test Master Runner
 * 
 * Orchestrates all comprehensive integration tests for the RunPod pipeline
 * Provides unified reporting and test execution management
 * 
 * Requirements covered: 1.1, 1.2, 3.3, 4.3
 */

const fs = require('fs').promises;
const path = require('path');

// Import all test suites
const comprehensiveTests = require('./test-runpod-integration-comprehensive');
const performanceBenchmarks = require('./test-runpod-performance-benchmarks');
const stressTests = require('./test-runpod-stress-concurrent');
const parameterTests = require('./test-runpod-parameter-combinations');

// Master test configuration
const MASTER_CONFIG = {
  testSuites: {
    comprehensive: {
      name: 'Comprehensive Integration Tests',
      module: comprehensiveTests,
      enabled: true,
      weight: 0.3, // 30% of overall score
      description: 'End-to-end workflow validation and basic functionality'
    },
    performance: {
      name: 'Performance Benchmarks',
      module: performanceBenchmarks,
      enabled: true,
      weight: 0.25, // 25% of overall score
      description: 'Training speed and quality performance validation'
    },
    stress: {
      name: 'Stress Testing',
      module: stressTests,
      enabled: true,
      weight: 0.25, // 25% of overall score
      description: 'Concurrent job handling and system resilience'
    },
    parameters: {
      name: 'Parameter Combination Testing',
      module: parameterTests,
      enabled: true,
      weight: 0.2, // 20% of overall score
      description: 'Parameter optimization and A/B testing validation'
    }
  },
  execution: {
    parallel: false, // Run tests sequentially to avoid resource conflicts
    continueOnFailure: true, // Continue running other tests even if one fails
    timeout: 30 * 60 * 1000, // 30 minutes total timeout
    retryFailedTests: false // Don't retry failed tests in master run
  },
  reporting: {
    generateUnifiedReport: true,
    saveIndividualReports: true,
    includeMetrics: true,
    includeRecommendations: true
  }
};

// Master test results tracking
const masterResults = {
  startTime: null,
  endTime: null,
  totalDuration: 0,
  suiteResults: {},
  overallScore: 0,
  overallGrade: 'F',
  requirementsCoverage: {},
  recommendations: [],
  errors: []
};

/**
 * Execute a single test suite
 */
async function executeTestSuite(suiteName, suiteConfig) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Executing: ${suiteConfig.name}`);
  console.log(`📝 Description: ${suiteConfig.description}`);
  console.log(`⚖️  Weight: ${suiteConfig.weight * 100}%`);
  console.log(`${'='.repeat(60)}`);
  
  const suiteStartTime = Date.now();
  let suiteResult = {
    name: suiteConfig.name,
    description: suiteConfig.description,
    weight: suiteConfig.weight,
    startTime: suiteStartTime,
    endTime: null,
    duration: 0,
    passed: false,
    score: 0,
    error: null,
    details: null
  };
  
  try {
    // Execute the test suite
    let testPassed = false;
    
    if (suiteConfig.module && typeof suiteConfig.module.runAllTests === 'function') {
      testPassed = await suiteConfig.module.runAllTests();
    } else if (suiteName === 'performance' && suiteConfig.module && typeof suiteConfig.module.runPerformanceBenchmarks === 'function') {
      testPassed = await suiteConfig.module.runPerformanceBenchmarks();
    } else if (suiteName === 'stress' && suiteConfig.module && typeof suiteConfig.module.runStressTests === 'function') {
      testPassed = await suiteConfig.module.runStressTests();
    } else if (suiteName === 'parameters' && suiteConfig.module && typeof suiteConfig.module.runParameterCombinationTests === 'function') {
      testPassed = await suiteConfig.module.runParameterCombinationTests();
    } else {
      throw new Error(`No suitable test runner method found for ${suiteName}. Available methods: ${Object.keys(suiteConfig.module || {}).join(', ')}`);
    }
    
    const suiteEndTime = Date.now();
    const suiteDuration = suiteEndTime - suiteStartTime;
    
    suiteResult.endTime = suiteEndTime;
    suiteResult.duration = suiteDuration;
    suiteResult.passed = testPassed;
    suiteResult.score = testPassed ? 100 : 0;
    
    console.log(`\n✅ ${suiteConfig.name} completed in ${Math.round(suiteDuration / 1000)}s`);
    console.log(`📊 Result: ${testPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`🎯 Score: ${suiteResult.score}%`);
    
  } catch (error) {
    const suiteEndTime = Date.now();
    const suiteDuration = suiteEndTime - suiteStartTime;
    
    suiteResult.endTime = suiteEndTime;
    suiteResult.duration = suiteDuration;
    suiteResult.passed = false;
    suiteResult.score = 0;
    suiteResult.error = error.message;
    
    console.log(`\n❌ ${suiteConfig.name} failed after ${Math.round(suiteDuration / 1000)}s`);
    console.log(`💥 Error: ${error.message}`);
    
    masterResults.errors.push(`${suiteConfig.name}: ${error.message}`);
    
    if (!MASTER_CONFIG.execution.continueOnFailure) {
      throw error;
    }
  }
  
  return suiteResult;
}

/**
 * Calculate overall score and grade
 */
function calculateOverallScore(suiteResults) {
  let weightedScore = 0;
  let totalWeight = 0;
  
  Object.values(suiteResults).forEach(result => {
    if (result.weight && typeof result.score === 'number') {
      weightedScore += result.score * result.weight;
      totalWeight += result.weight;
    }
  });
  
  const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  
  let grade = 'F';
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';
  
  return { overallScore: Math.round(overallScore), grade };
}

/**
 * Analyze requirements coverage
 */
function analyzeRequirementsCoverage(suiteResults) {
  const requirements = {
    '1.1': {
      description: 'Training reliability and progress tracking',
      covered: false,
      coveringSuites: []
    },
    '1.2': {
      description: 'Training completion notifications and status updates',
      covered: false,
      coveringSuites: []
    },
    '3.3': {
      description: 'Quality assessment and comparison metrics',
      covered: false,
      coveringSuites: []
    },
    '4.3': {
      description: 'Comprehensive error handling and logging',
      covered: false,
      coveringSuites: []
    }
  };
  
  // Map test suites to requirements
  if (suiteResults.comprehensive && suiteResults.comprehensive.passed) {
    requirements['1.1'].covered = true;
    requirements['1.1'].coveringSuites.push('Comprehensive Integration Tests');
    requirements['1.2'].covered = true;
    requirements['1.2'].coveringSuites.push('Comprehensive Integration Tests');
    requirements['4.3'].covered = true;
    requirements['4.3'].coveringSuites.push('Comprehensive Integration Tests');
  }
  
  if (suiteResults.performance && suiteResults.performance.passed) {
    requirements['1.1'].covered = true;
    requirements['1.1'].coveringSuites.push('Performance Benchmarks');
    requirements['1.2'].covered = true;
    requirements['1.2'].coveringSuites.push('Performance Benchmarks');
  }
  
  if (suiteResults.stress && suiteResults.stress.passed) {
    requirements['1.1'].covered = true;
    requirements['1.1'].coveringSuites.push('Stress Testing');
    requirements['1.2'].covered = true;
    requirements['1.2'].coveringSuites.push('Stress Testing');
    requirements['4.3'].covered = true;
    requirements['4.3'].coveringSuites.push('Stress Testing');
  }
  
  if (suiteResults.parameters && suiteResults.parameters.passed) {
    requirements['3.3'].covered = true;
    requirements['3.3'].coveringSuites.push('Parameter Combination Testing');
    requirements['4.3'].covered = true;
    requirements['4.3'].coveringSuites.push('Parameter Combination Testing');
  }
  
  return requirements;
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(suiteResults, overallScore, requirementsCoverage) {
  const recommendations = [];
  
  // Overall score recommendations
  if (overallScore < 70) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Overall System',
      recommendation: 'System requires significant improvements before production deployment',
      details: 'Multiple test suites failed. Address critical issues in failed areas.'
    });
  } else if (overallScore < 85) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Overall System',
      recommendation: 'System is functional but has room for improvement',
      details: 'Consider optimizing areas with lower scores before full production rollout.'
    });
  }
  
  // Suite-specific recommendations
  Object.entries(suiteResults).forEach(([suiteName, result]) => {
    if (!result.passed) {
      recommendations.push({
        priority: 'HIGH',
        category: result.name,
        recommendation: `Address failures in ${result.name}`,
        details: result.error || 'Review detailed test logs for specific issues'
      });
    } else if (result.score < 80) {
      recommendations.push({
        priority: 'MEDIUM',
        category: result.name,
        recommendation: `Optimize ${result.name} performance`,
        details: 'Some tests passed but with suboptimal performance'
      });
    }
  });
  
  // Requirements coverage recommendations
  Object.entries(requirementsCoverage).forEach(([reqId, req]) => {
    if (!req.covered) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Requirements Coverage',
        recommendation: `Requirement ${reqId} not fully covered`,
        details: `${req.description} - Ensure this requirement is properly tested`
      });
    }
  });
  
  // Performance-specific recommendations
  if (suiteResults.performance && suiteResults.performance.score < 80) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Performance',
      recommendation: 'Optimize API response times and training performance',
      details: 'Consider implementing caching, connection pooling, and resource optimization'
    });
  }
  
  // Stress testing recommendations
  if (suiteResults.stress && suiteResults.stress.score < 80) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Scalability',
      recommendation: 'Improve concurrent request handling',
      details: 'Implement better rate limiting, queue management, and resource allocation'
    });
  }
  
  // Parameter testing recommendations
  if (suiteResults.parameters && suiteResults.parameters.score < 80) {
    recommendations.push({
      priority: 'LOW',
      category: 'Parameter Optimization',
      recommendation: 'Fine-tune parameter optimization algorithms',
      details: 'Review A/B testing results and parameter validation logic'
    });
  }
  
  // Production readiness recommendations
  if (overallScore >= 85) {
    recommendations.push({
      priority: 'LOW',
      category: 'Production Readiness',
      recommendation: 'System is ready for production deployment',
      details: 'Monitor production metrics and implement gradual rollout strategy'
    });
  }
  
  return recommendations;
}

/**
 * Generate unified test report
 */
async function generateUnifiedReport() {
  console.log('\n📊 Unified Integration Test Report');
  console.log('=' .repeat(80));
  
  // Test execution summary
  console.log('\n⏱️  Test Execution Summary:');
  console.log(`  Start Time: ${new Date(masterResults.startTime).toISOString()}`);
  console.log(`  End Time: ${new Date(masterResults.endTime).toISOString()}`);
  console.log(`  Total Duration: ${Math.round(masterResults.totalDuration / 1000)}s (${Math.round(masterResults.totalDuration / 60000)}m)`);
  
  // Suite results summary
  console.log('\n🧪 Test Suite Results:');
  Object.entries(masterResults.suiteResults).forEach(([suiteName, result]) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const duration = Math.round(result.duration / 1000);
    console.log(`  ${status} ${result.name} (${duration}s, ${result.score}%, weight: ${result.weight * 100}%)`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  // Overall score and grade
  console.log('\n📈 Overall Results:');
  console.log(`  🎯 Overall Score: ${masterResults.overallScore}%`);
  console.log(`  🏆 Overall Grade: ${masterResults.overallGrade}`);
  
  const passedSuites = Object.values(masterResults.suiteResults).filter(r => r.passed).length;
  const totalSuites = Object.keys(masterResults.suiteResults).length;
  console.log(`  📊 Suites Passed: ${passedSuites}/${totalSuites}`);
  
  // Requirements coverage
  console.log('\n📋 Requirements Coverage:');
  Object.entries(masterResults.requirementsCoverage).forEach(([reqId, req]) => {
    const status = req.covered ? '✅' : '❌';
    console.log(`  ${status} ${reqId}: ${req.description}`);
    if (req.covered && req.coveringSuites.length > 0) {
      console.log(`    Covered by: ${req.coveringSuites.join(', ')}`);
    }
  });
  
  // Recommendations
  if (masterResults.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    
    const highPriority = masterResults.recommendations.filter(r => r.priority === 'HIGH');
    const mediumPriority = masterResults.recommendations.filter(r => r.priority === 'MEDIUM');
    const lowPriority = masterResults.recommendations.filter(r => r.priority === 'LOW');
    
    if (highPriority.length > 0) {
      console.log('\n  🔴 HIGH PRIORITY:');
      highPriority.forEach(rec => {
        console.log(`    • ${rec.recommendation}`);
        console.log(`      ${rec.details}`);
      });
    }
    
    if (mediumPriority.length > 0) {
      console.log('\n  🟡 MEDIUM PRIORITY:');
      mediumPriority.forEach(rec => {
        console.log(`    • ${rec.recommendation}`);
        console.log(`      ${rec.details}`);
      });
    }
    
    if (lowPriority.length > 0) {
      console.log('\n  🟢 LOW PRIORITY:');
      lowPriority.forEach(rec => {
        console.log(`    • ${rec.recommendation}`);
        console.log(`      ${rec.details}`);
      });
    }
  }
  
  // Production readiness assessment
  console.log('\n🚀 Production Readiness Assessment:');
  if (masterResults.overallScore >= 85) {
    console.log('  ✅ READY FOR PRODUCTION');
    console.log('  The RunPod pipeline has passed comprehensive testing and is ready for production deployment.');
    console.log('  Implement monitoring and gradual rollout strategy.');
  } else if (masterResults.overallScore >= 70) {
    console.log('  ⚠️  CONDITIONALLY READY');
    console.log('  The RunPod pipeline has basic functionality but requires optimization.');
    console.log('  Address medium and high priority recommendations before full production rollout.');
  } else {
    console.log('  ❌ NOT READY FOR PRODUCTION');
    console.log('  The RunPod pipeline has significant issues that must be resolved.');
    console.log('  Address all high priority recommendations before considering production deployment.');
  }
  
  // Save unified report
  if (MASTER_CONFIG.reporting.generateUnifiedReport) {
    const reportData = {
      timestamp: new Date().toISOString(),
      testConfiguration: MASTER_CONFIG,
      executionSummary: {
        startTime: masterResults.startTime,
        endTime: masterResults.endTime,
        totalDuration: masterResults.totalDuration,
        totalSuites: Object.keys(masterResults.suiteResults).length,
        passedSuites: Object.values(masterResults.suiteResults).filter(r => r.passed).length
      },
      suiteResults: masterResults.suiteResults,
      overallResults: {
        score: masterResults.overallScore,
        grade: masterResults.overallGrade
      },
      requirementsCoverage: masterResults.requirementsCoverage,
      recommendations: masterResults.recommendations,
      errors: masterResults.errors,
      productionReadiness: {
        ready: masterResults.overallScore >= 85,
        conditionallyReady: masterResults.overallScore >= 70 && masterResults.overallScore < 85,
        notReady: masterResults.overallScore < 70,
        assessment: masterResults.overallScore >= 85 ? 'READY FOR PRODUCTION' :
                   masterResults.overallScore >= 70 ? 'CONDITIONALLY READY' : 'NOT READY FOR PRODUCTION'
      }
    };
    
    try {
      await fs.writeFile(
        'test-runpod-integration-unified-report.json',
        JSON.stringify(reportData, null, 2)
      );
      console.log('\n💾 Unified report saved to: test-runpod-integration-unified-report.json');
    } catch (error) {
      console.log('\n⚠️  Could not save unified report:', error.message);
    }
  }
  
  return masterResults.overallScore >= 70;
}

/**
 * Run all integration tests
 */
async function runAllIntegrationTests() {
  console.log('🚀 Starting RunPod Comprehensive Integration Test Suite');
  console.log('=' .repeat(80));
  console.log('📋 Test Configuration:');
  console.log(`  Parallel Execution: ${MASTER_CONFIG.execution.parallel ? 'Enabled' : 'Disabled'}`);
  console.log(`  Continue on Failure: ${MASTER_CONFIG.execution.continueOnFailure ? 'Enabled' : 'Disabled'}`);
  console.log(`  Total Timeout: ${MASTER_CONFIG.execution.timeout / 60000} minutes`);
  console.log(`  Test Suites: ${Object.keys(MASTER_CONFIG.testSuites).length}`);
  
  masterResults.startTime = Date.now();
  
  try {
    // Execute test suites
    if (MASTER_CONFIG.execution.parallel) {
      // Parallel execution (not recommended for resource-intensive tests)
      console.log('\n⚡ Executing test suites in parallel...');
      
      const suitePromises = Object.entries(MASTER_CONFIG.testSuites)
        .filter(([_, config]) => config.enabled)
        .map(([suiteName, config]) => 
          executeTestSuite(suiteName, config).catch(error => ({
            name: config.name,
            error: error.message,
            passed: false,
            score: 0
          }))
        );
      
      const suiteResults = await Promise.all(suitePromises);
      
      suiteResults.forEach((result, index) => {
        const suiteName = Object.keys(MASTER_CONFIG.testSuites)[index];
        masterResults.suiteResults[suiteName] = result;
      });
      
    } else {
      // Sequential execution (recommended)
      console.log('\n🔄 Executing test suites sequentially...');
      
      for (const [suiteName, suiteConfig] of Object.entries(MASTER_CONFIG.testSuites)) {
        if (suiteConfig.enabled) {
          const suiteResult = await executeTestSuite(suiteName, suiteConfig);
          masterResults.suiteResults[suiteName] = suiteResult;
        }
      }
    }
    
    masterResults.endTime = Date.now();
    masterResults.totalDuration = masterResults.endTime - masterResults.startTime;
    
    // Calculate overall score and grade
    const { overallScore, grade } = calculateOverallScore(masterResults.suiteResults);
    masterResults.overallScore = overallScore;
    masterResults.overallGrade = grade;
    
    // Analyze requirements coverage
    masterResults.requirementsCoverage = analyzeRequirementsCoverage(masterResults.suiteResults);
    
    // Generate recommendations
    masterResults.recommendations = generateRecommendations(
      masterResults.suiteResults,
      masterResults.overallScore,
      masterResults.requirementsCoverage
    );
    
    // Generate unified report
    const testsPassed = await generateUnifiedReport();
    
    if (testsPassed) {
      console.log('\n🎉 Integration tests completed successfully!');
      console.log('✅ RunPod pipeline is ready for production use.');
    } else {
      console.log('\n⚠️  Integration tests completed with issues.');
      console.log('🔧 Address the recommendations before production deployment.');
    }
    
    return testsPassed;
    
  } catch (error) {
    masterResults.endTime = Date.now();
    masterResults.totalDuration = masterResults.endTime - masterResults.startTime;
    
    console.error('\n💥 Integration test execution failed:', error);
    console.error('Stack trace:', error.stack);
    
    masterResults.errors.push(`Master execution error: ${error.message}`);
    
    // Still try to generate a report with partial results
    try {
      await generateUnifiedReport();
    } catch (reportError) {
      console.error('Failed to generate report:', reportError.message);
    }
    
    return false;
  }
}

// Export for use in other files
module.exports = {
  runAllIntegrationTests,
  executeTestSuite,
  generateUnifiedReport,
  MASTER_CONFIG,
  masterResults
};

// Run all tests if this file is executed directly
if (require.main === module) {
  runAllIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Integration test execution failed:', error);
      process.exit(1);
    });
}