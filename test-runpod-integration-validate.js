#!/usr/bin/env node

/**
 * RunPod Integration Test Validation
 * 
 * Validates the test structure and ensures all test files are properly configured
 * without requiring a running server
 */

const fs = require('fs').promises;
const path = require('path');

// Test files to validate
const TEST_FILES = [
  'test-runpod-integration-comprehensive.js',
  'test-runpod-performance-benchmarks.js',
  'test-runpod-stress-concurrent.js',
  'test-runpod-parameter-combinations.js',
  'test-runpod-integration-master.js'
];

/**
 * Validate test file structure
 */
async function validateTestFile(filename) {
  console.log(`\n📋 Validating ${filename}:`);
  
  try {
    // Check if file exists
    const filePath = path.join(__dirname, filename);
    await fs.access(filePath);
    console.log('  ✅ File exists');
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    console.log(`  ✅ File readable (${content.length} characters)`);
    
    // Check for required exports
    const requiredExports = {
      'test-runpod-integration-comprehensive.js': ['runAllTests'],
      'test-runpod-performance-benchmarks.js': ['runPerformanceBenchmarks'],
      'test-runpod-stress-concurrent.js': ['runStressTests'],
      'test-runpod-parameter-combinations.js': ['runParameterCombinationTests'],
      'test-runpod-integration-master.js': ['runAllIntegrationTests']
    };
    
    const expectedExports = requiredExports[filename] || [];
    for (const exportName of expectedExports) {
      if (content.includes(`module.exports`) && content.includes(exportName)) {
        console.log(`  ✅ Export '${exportName}' found`);
      } else {
        console.log(`  ❌ Export '${exportName}' missing`);
      }
    }
    
    // Check for test configuration
    if (content.includes('CONFIG') || content.includes('config')) {
      console.log('  ✅ Configuration found');
    } else {
      console.log('  ⚠️  No configuration found');
    }
    
    // Check for error handling
    if (content.includes('try') && content.includes('catch')) {
      console.log('  ✅ Error handling found');
    } else {
      console.log('  ⚠️  Limited error handling');
    }
    
    // Check for logging
    if (content.includes('console.log')) {
      console.log('  ✅ Logging found');
    } else {
      console.log('  ⚠️  No logging found');
    }
    
    return true;
    
  } catch (error) {
    console.log(`  ❌ Validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Test module imports
 */
async function testModuleImports() {
  console.log('\n🔧 Testing Module Imports:');
  
  const modules = {
    'comprehensive': './test-runpod-integration-comprehensive',
    'performance': './test-runpod-performance-benchmarks',
    'stress': './test-runpod-stress-concurrent',
    'parameters': './test-runpod-parameter-combinations'
  };
  
  for (const [name, modulePath] of Object.entries(modules)) {
    try {
      const module = require(modulePath);
      console.log(`  ✅ ${name}: Module loaded successfully`);
      
      // Check for expected methods
      const expectedMethods = {
        'comprehensive': 'runAllTests',
        'performance': 'runPerformanceBenchmarks',
        'stress': 'runStressTests',
        'parameters': 'runParameterCombinationTests'
      };
      
      const expectedMethod = expectedMethods[name];
      if (typeof module[expectedMethod] === 'function') {
        console.log(`  ✅ ${name}: Method '${expectedMethod}' available`);
      } else {
        console.log(`  ❌ ${name}: Method '${expectedMethod}' missing`);
        console.log(`  📋 Available methods: ${Object.keys(module).filter(k => typeof module[k] === 'function').join(', ')}`);
      }
      
    } catch (error) {
      console.log(`  ❌ ${name}: Import failed - ${error.message}`);
    }
  }
}

/**
 * Validate test configurations
 */
async function validateTestConfigurations() {
  console.log('\n⚙️  Validating Test Configurations:');
  
  try {
    const comprehensive = require('./test-runpod-integration-comprehensive');
    if (comprehensive.TEST_CONFIG) {
      console.log('  ✅ Comprehensive: Configuration found');
      console.log(`    Base URL: ${comprehensive.TEST_CONFIG.baseUrl}`);
      console.log(`    Timeout: ${comprehensive.TEST_CONFIG.testTimeout}ms`);
    } else {
      console.log('  ❌ Comprehensive: No configuration found');
    }
  } catch (error) {
    console.log(`  ❌ Comprehensive: ${error.message}`);
  }
  
  try {
    const performance = require('./test-runpod-performance-benchmarks');
    if (performance.BENCHMARK_CONFIG) {
      console.log('  ✅ Performance: Configuration found');
      console.log(`    Base URL: ${performance.BENCHMARK_CONFIG.baseUrl}`);
    } else {
      console.log('  ❌ Performance: No configuration found');
    }
  } catch (error) {
    console.log(`  ❌ Performance: ${error.message}`);
  }
  
  try {
    const stress = require('./test-runpod-stress-concurrent');
    if (stress.STRESS_CONFIG) {
      console.log('  ✅ Stress: Configuration found');
      console.log(`    Base URL: ${stress.STRESS_CONFIG.baseUrl}`);
      console.log(`    Max Concurrent: ${stress.STRESS_CONFIG.concurrency.maxConcurrentJobs}`);
    } else {
      console.log('  ❌ Stress: No configuration found');
    }
  } catch (error) {
    console.log(`  ❌ Stress: ${error.message}`);
  }
  
  try {
    const parameters = require('./test-runpod-parameter-combinations');
    if (parameters.PARAMETER_CONFIG) {
      console.log('  ✅ Parameters: Configuration found');
      console.log(`    Base URL: ${parameters.PARAMETER_CONFIG.baseUrl}`);
      console.log(`    A/B Testing: ${parameters.PARAMETER_CONFIG.abTesting.enabled}`);
    } else {
      console.log('  ❌ Parameters: No configuration found');
    }
  } catch (error) {
    console.log(`  ❌ Parameters: ${error.message}`);
  }
}

/**
 * Generate test structure report
 */
async function generateTestStructureReport() {
  console.log('\n📊 Test Structure Report:');
  
  const report = {
    timestamp: new Date().toISOString(),
    testFiles: TEST_FILES.length,
    validatedFiles: 0,
    testSuites: {
      comprehensive: {
        description: 'End-to-end workflow validation',
        requirements: ['1.1', '1.2', '3.3', '4.3'],
        status: 'unknown'
      },
      performance: {
        description: 'Training speed and quality benchmarks',
        requirements: ['1.1', '1.2', '3.3'],
        status: 'unknown'
      },
      stress: {
        description: 'Concurrent job handling and resilience',
        requirements: ['1.1', '1.2', '4.3'],
        status: 'unknown'
      },
      parameters: {
        description: 'Parameter optimization and A/B testing',
        requirements: ['3.3', '4.3'],
        status: 'unknown'
      }
    },
    requirementsCoverage: {
      '1.1': 'Training reliability and progress tracking',
      '1.2': 'Training completion notifications and status updates',
      '3.3': 'Quality assessment and comparison metrics',
      '4.3': 'Comprehensive error handling and logging'
    }
  };
  
  // Test each module
  try {
    require('./test-runpod-integration-comprehensive');
    report.testSuites.comprehensive.status = 'available';
    report.validatedFiles++;
  } catch (error) {
    report.testSuites.comprehensive.status = 'error';
    report.testSuites.comprehensive.error = error.message;
  }
  
  try {
    require('./test-runpod-performance-benchmarks');
    report.testSuites.performance.status = 'available';
    report.validatedFiles++;
  } catch (error) {
    report.testSuites.performance.status = 'error';
    report.testSuites.performance.error = error.message;
  }
  
  try {
    require('./test-runpod-stress-concurrent');
    report.testSuites.stress.status = 'available';
    report.validatedFiles++;
  } catch (error) {
    report.testSuites.stress.status = 'error';
    report.testSuites.stress.error = error.message;
  }
  
  try {
    require('./test-runpod-parameter-combinations');
    report.testSuites.parameters.status = 'available';
    report.validatedFiles++;
  } catch (error) {
    report.testSuites.parameters.status = 'error';
    report.testSuites.parameters.error = error.message;
  }
  
  console.log(`  📋 Total test files: ${report.testFiles}`);
  console.log(`  ✅ Validated files: ${report.validatedFiles}`);
  console.log(`  📊 Success rate: ${Math.round((report.validatedFiles / report.testFiles) * 100)}%`);
  
  console.log('\n  🧪 Test Suite Status:');
  Object.entries(report.testSuites).forEach(([name, suite]) => {
    const status = suite.status === 'available' ? '✅' : '❌';
    console.log(`    ${status} ${name}: ${suite.description}`);
    if (suite.error) {
      console.log(`      Error: ${suite.error}`);
    }
    console.log(`      Requirements: ${suite.requirements.join(', ')}`);
  });
  
  console.log('\n  📋 Requirements Coverage:');
  Object.entries(report.requirementsCoverage).forEach(([reqId, description]) => {
    const coveringSuites = Object.entries(report.testSuites)
      .filter(([_, suite]) => suite.requirements.includes(reqId) && suite.status === 'available')
      .map(([name, _]) => name);
    
    const status = coveringSuites.length > 0 ? '✅' : '❌';
    console.log(`    ${status} ${reqId}: ${description}`);
    if (coveringSuites.length > 0) {
      console.log(`      Covered by: ${coveringSuites.join(', ')}`);
    }
  });
  
  // Save report
  try {
    await fs.writeFile(
      'test-runpod-integration-structure-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n💾 Structure report saved to: test-runpod-integration-structure-report.json');
  } catch (error) {
    console.log('\n⚠️  Could not save structure report:', error.message);
  }
  
  return report.validatedFiles === report.testFiles;
}

/**
 * Run validation
 */
async function runValidation() {
  console.log('🔍 RunPod Integration Test Structure Validation');
  console.log('=' .repeat(60));
  
  let allValid = true;
  
  // Validate individual test files
  for (const filename of TEST_FILES) {
    const isValid = await validateTestFile(filename);
    if (!isValid) allValid = false;
  }
  
  // Test module imports
  await testModuleImports();
  
  // Validate configurations
  await validateTestConfigurations();
  
  // Generate structure report
  const structureValid = await generateTestStructureReport();
  
  console.log('\n📈 Validation Summary:');
  if (allValid && structureValid) {
    console.log('✅ All test files are properly structured and ready for execution');
    console.log('🚀 Integration tests can be run when the server is available');
  } else {
    console.log('❌ Some test files have issues that need to be addressed');
    console.log('🔧 Fix the issues before running integration tests');
  }
  
  return allValid && structureValid;
}

// Run validation if this file is executed directly
if (require.main === module) {
  runValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runValidation,
  validateTestFile,
  testModuleImports,
  validateTestConfigurations,
  generateTestStructureReport
};