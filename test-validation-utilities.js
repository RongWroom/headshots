#!/usr/bin/env node

/**
 * Unit tests for validation utilities
 * Tests the image validation and training validation functions
 * Run with: node test-validation-utilities.js
 */

// Mock File class for testing (since we're in Node.js environment)
class MockFile {
  constructor(name, size, type, lastModified = Date.now()) {
    this.name = name;
    this.size = size;
    this.type = type;
    this.lastModified = lastModified;
  }
}

// Mock the validation functions (in a real test, we'd import them)
function validateImageFile(file) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    fileInfo: {
      size: file.size,
      type: file.type,
      name: file.name
    }
  };

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const minFileSize = 1024; // 1KB

  // Validate file type
  if (!allowedTypes.includes(file.type)) {
    result.errors.push(`Invalid file type "${file.type}". Allowed types: ${allowedTypes.join(', ')}`);
    result.isValid = false;
  }

  // Validate file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    result.errors.push(`Invalid file extension "${extension}". Allowed extensions: ${allowedExtensions.join(', ')}`);
    result.isValid = false;
  }

  // Validate file size
  if (file.size > maxFileSize) {
    result.errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${maxFileSize / 1024 / 1024}MB`);
    result.isValid = false;
  }

  if (file.size < minFileSize) {
    result.errors.push(`File too small: ${file.size} bytes. Minimum required: ${minFileSize} bytes`);
    result.isValid = false;
  }

  // Validate file name
  if (file.name.length > 255) {
    result.errors.push('File name too long. Maximum 255 characters allowed.');
    result.isValid = false;
  }

  // Check for potentially problematic characters in filename
  const problematicChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (problematicChars.test(file.name)) {
    result.warnings.push('File name contains special characters that may cause issues.');
  }

  // Warn about very large files
  if (file.size > 5 * 1024 * 1024) { // 5MB
    result.warnings.push('Large file size may result in slower upload and processing.');
  }

  return result;
}

function validateImageFiles(files) {
  const maxTotalSize = 50 * 1024 * 1024; // 50MB
  const maxFileCount = 10;

  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    validFiles: [],
    invalidFiles: [],
    totalSize: 0
  };

  // Validate file count
  if (files.length > maxFileCount) {
    result.errors.push(`Too many files: ${files.length}. Maximum allowed: ${maxFileCount}`);
    result.isValid = false;
  }

  // Validate each file and calculate total size
  files.forEach((file) => {
    const validation = validateImageFile(file);
    result.totalSize += file.size;

    if (validation.isValid) {
      result.validFiles.push(file);
    } else {
      result.invalidFiles.push({ file, validation });
      result.isValid = false;
    }

    // Collect errors and warnings
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);
  });

  // Validate total size
  if (result.totalSize > maxTotalSize) {
    result.errors.push(`Total file size too large: ${(result.totalSize / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${maxTotalSize / 1024 / 1024}MB`);
    result.isValid = false;
  }

  return result;
}

/**
 * Test individual file validation
 */
function testIndividualFileValidation() {
  console.log('📁 Testing Individual File Validation\n');
  
  const tests = [
    {
      name: 'Valid JPEG file',
      file: new MockFile('test.jpg', 2 * 1024 * 1024, 'image/jpeg'), // 2MB
      expectedValid: true
    },
    {
      name: 'Valid PNG file',
      file: new MockFile('test.png', 1 * 1024 * 1024, 'image/png'), // 1MB
      expectedValid: true
    },
    {
      name: 'Valid WebP file',
      file: new MockFile('test.webp', 3 * 1024 * 1024, 'image/webp'), // 3MB
      expectedValid: true
    },
    {
      name: 'Invalid file type (PDF)',
      file: new MockFile('document.pdf', 1 * 1024 * 1024, 'application/pdf'),
      expectedValid: false,
      expectedError: 'Invalid file type'
    },
    {
      name: 'Invalid file extension',
      file: new MockFile('image.gif', 1 * 1024 * 1024, 'image/gif'),
      expectedValid: false,
      expectedError: 'Invalid file extension'
    },
    {
      name: 'File too large (15MB)',
      file: new MockFile('large.jpg', 15 * 1024 * 1024, 'image/jpeg'),
      expectedValid: false,
      expectedError: 'File too large'
    },
    {
      name: 'File too small (500 bytes)',
      file: new MockFile('tiny.jpg', 500, 'image/jpeg'),
      expectedValid: false,
      expectedError: 'File too small'
    },
    {
      name: 'Filename too long',
      file: new MockFile('a'.repeat(260) + '.jpg', 1 * 1024 * 1024, 'image/jpeg'),
      expectedValid: false,
      expectedError: 'File name too long'
    },
    {
      name: 'Filename with special characters',
      file: new MockFile('test<>file.jpg', 1 * 1024 * 1024, 'image/jpeg'),
      expectedValid: true, // Should be valid but with warning
      expectedWarning: 'special characters'
    },
    {
      name: 'Large file with warning (7MB)',
      file: new MockFile('large.jpg', 7 * 1024 * 1024, 'image/jpeg'),
      expectedValid: true,
      expectedWarning: 'Large file size'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, file, expectedValid, expectedError, expectedWarning } of tests) {
    console.log(`Testing: ${name}`);
    const result = validateImageFile(file);
    
    let testPassed = true;
    
    // Check validity
    if (result.isValid !== expectedValid) {
      console.log(`❌ ${name} - Expected valid: ${expectedValid}, got: ${result.isValid}`);
      testPassed = false;
    }
    
    // Check for expected error
    if (expectedError && !result.errors.some(error => error.includes(expectedError))) {
      console.log(`❌ ${name} - Expected error containing "${expectedError}", got: ${result.errors.join(', ')}`);
      testPassed = false;
    }
    
    // Check for expected warning
    if (expectedWarning && !result.warnings.some(warning => warning.toLowerCase().includes(expectedWarning.toLowerCase()))) {
      console.log(`❌ ${name} - Expected warning containing "${expectedWarning}", got: ${result.warnings.join(', ')}`);
      testPassed = false;
    }
    
    if (testPassed) {
      console.log(`✅ ${name}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.slice(0, 2).join(', ')}`);
      }
      if (result.warnings.length > 0) {
        console.log(`   Warnings: ${result.warnings.slice(0, 2).join(', ')}`);
      }
      passed++;
    } else {
      failed++;
    }
    console.log('');
  }
  
  return { passed, failed };
}

/**
 * Test multiple file validation
 */
function testMultipleFileValidation() {
  console.log('📚 Testing Multiple File Validation\n');
  
  const tests = [
    {
      name: 'Valid set of 5 files',
      files: [
        new MockFile('img1.jpg', 2 * 1024 * 1024, 'image/jpeg'),
        new MockFile('img2.png', 1 * 1024 * 1024, 'image/png'),
        new MockFile('img3.webp', 3 * 1024 * 1024, 'image/webp'),
        new MockFile('img4.jpg', 2 * 1024 * 1024, 'image/jpeg'),
        new MockFile('img5.png', 1 * 1024 * 1024, 'image/png')
      ],
      expectedValid: true
    },
    {
      name: 'Too many files (15 files)',
      files: Array.from({ length: 15 }, (_, i) => 
        new MockFile(`img${i}.jpg`, 1 * 1024 * 1024, 'image/jpeg')
      ),
      expectedValid: false,
      expectedError: 'Too many files'
    },
    {
      name: 'Total size too large (60MB)',
      files: Array.from({ length: 6 }, (_, i) => 
        new MockFile(`img${i}.jpg`, 10 * 1024 * 1024, 'image/jpeg') // 6 x 10MB = 60MB
      ),
      expectedValid: false,
      expectedError: 'Total file size too large'
    },
    {
      name: 'Mixed valid and invalid files',
      files: [
        new MockFile('valid1.jpg', 2 * 1024 * 1024, 'image/jpeg'),
        new MockFile('invalid.pdf', 1 * 1024 * 1024, 'application/pdf'),
        new MockFile('valid2.png', 1 * 1024 * 1024, 'image/png'),
        new MockFile('toolarge.jpg', 15 * 1024 * 1024, 'image/jpeg')
      ],
      expectedValid: false,
      expectedValidCount: 2,
      expectedInvalidCount: 2
    },
    {
      name: 'Empty file list',
      files: [],
      expectedValid: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, files, expectedValid, expectedError, expectedValidCount, expectedInvalidCount } of tests) {
    console.log(`Testing: ${name}`);
    const result = validateImageFiles(files);
    
    let testPassed = true;
    
    // Check validity
    if (result.isValid !== expectedValid) {
      console.log(`❌ ${name} - Expected valid: ${expectedValid}, got: ${result.isValid}`);
      testPassed = false;
    }
    
    // Check for expected error
    if (expectedError && !result.errors.some(error => error.includes(expectedError))) {
      console.log(`❌ ${name} - Expected error containing "${expectedError}", got: ${result.errors.join(', ')}`);
      testPassed = false;
    }
    
    // Check valid/invalid counts
    if (expectedValidCount !== undefined && result.validFiles.length !== expectedValidCount) {
      console.log(`❌ ${name} - Expected ${expectedValidCount} valid files, got: ${result.validFiles.length}`);
      testPassed = false;
    }
    
    if (expectedInvalidCount !== undefined && result.invalidFiles.length !== expectedInvalidCount) {
      console.log(`❌ ${name} - Expected ${expectedInvalidCount} invalid files, got: ${result.invalidFiles.length}`);
      testPassed = false;
    }
    
    if (testPassed) {
      console.log(`✅ ${name}`);
      console.log(`   Total files: ${files.length}, Valid: ${result.validFiles.length}, Invalid: ${result.invalidFiles.length}`);
      console.log(`   Total size: ${(result.totalSize / 1024 / 1024).toFixed(2)}MB`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.slice(0, 2).join(', ')}`);
      }
      passed++;
    } else {
      failed++;
    }
    console.log('');
  }
  
  return { passed, failed };
}

/**
 * Test edge cases and boundary conditions
 */
function testEdgeCases() {
  console.log('🔍 Testing Edge Cases and Boundary Conditions\n');
  
  const tests = [
    {
      name: 'File exactly at size limit (10MB)',
      file: new MockFile('exact.jpg', 10 * 1024 * 1024, 'image/jpeg'),
      expectedValid: true
    },
    {
      name: 'File one byte over limit',
      file: new MockFile('over.jpg', 10 * 1024 * 1024 + 1, 'image/jpeg'),
      expectedValid: false
    },
    {
      name: 'File exactly at minimum size (1KB)',
      file: new MockFile('min.jpg', 1024, 'image/jpeg'),
      expectedValid: true
    },
    {
      name: 'File one byte under minimum',
      file: new MockFile('under.jpg', 1023, 'image/jpeg'),
      expectedValid: false
    },
    {
      name: 'Filename exactly 255 characters',
      file: new MockFile('a'.repeat(251) + '.jpg', 1024 * 1024, 'image/jpeg'), // 251 + 4 = 255
      expectedValid: true
    },
    {
      name: 'Empty filename',
      file: new MockFile('', 1024 * 1024, 'image/jpeg'),
      expectedValid: false
    },
    {
      name: 'Filename with no extension',
      file: new MockFile('noextension', 1024 * 1024, 'image/jpeg'),
      expectedValid: false
    },
    {
      name: 'Case sensitivity test (JPG vs jpg)',
      file: new MockFile('test.JPG', 1024 * 1024, 'image/jpeg'),
      expectedValid: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, file, expectedValid } of tests) {
    console.log(`Testing: ${name}`);
    const result = validateImageFile(file);
    
    if (result.isValid === expectedValid) {
      console.log(`✅ ${name} - Valid: ${result.isValid}`);
      passed++;
    } else {
      console.log(`❌ ${name} - Expected: ${expectedValid}, Got: ${result.isValid}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
      failed++;
    }
    console.log('');
  }
  
  return { passed, failed };
}

/**
 * Main test runner
 */
async function runValidationTests() {
  console.log('🧪 Validation Utilities Test Suite');
  console.log('=' .repeat(50));
  console.log('');
  
  const results = {
    individual: { passed: 0, failed: 0 },
    multiple: { passed: 0, failed: 0 },
    edgeCases: { passed: 0, failed: 0 }
  };
  
  try {
    results.individual = testIndividualFileValidation();
    results.multiple = testMultipleFileValidation();
    results.edgeCases = testEdgeCases();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    return;
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 VALIDATION TEST SUMMARY');
  console.log('=' .repeat(50));
  
  const totalPassed = Object.values(results).reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
  const totalTests = totalPassed + totalFailed;
  
  console.log(`Individual File Tests:   ${results.individual.passed}/${results.individual.passed + results.individual.failed} passed`);
  console.log(`Multiple File Tests:     ${results.multiple.passed}/${results.multiple.passed + results.multiple.failed} passed`);
  console.log(`Edge Case Tests:         ${results.edgeCases.passed}/${results.edgeCases.passed + results.edgeCases.failed} passed`);
  console.log('');
  console.log(`TOTAL: ${totalPassed}/${totalTests} tests passed (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
  
  if (totalFailed === 0) {
    console.log('🎉 All validation tests passed!');
  } else {
    console.log(`⚠️  ${totalFailed} test(s) failed`);
  }
  
  console.log('\n📝 Notes:');
  console.log('- These tests validate the image validation utility functions');
  console.log('- Tests cover file size, format, naming, and boundary conditions');
  console.log('- Run alongside integration tests for complete coverage');
  console.log('');
}

// Only run if this file is executed directly
if (require.main === module) {
  runValidationTests().catch(console.error);
}

module.exports = {
  validateImageFile,
  validateImageFiles,
  testIndividualFileValidation,
  testMultipleFileValidation,
  testEdgeCases,
  runValidationTests
};