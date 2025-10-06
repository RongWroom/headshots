/**
 * Validation script for style catalog
 * Run with: npx tsx lib/validate-style-catalog.ts
 */

import {
  STYLE_CATALOG,
  getStyleById,
  getStylesByCategory,
  getAllStyleIds,
  isValidStyleId,
  getDefaultStyle,
  buildNegativePrompt,
} from './style-catalog';

console.log('🎨 Validating Style Catalog...\n');

// Validate catalog has at least 3 styles
console.log(`✓ Total styles: ${STYLE_CATALOG.length}`);
if (STYLE_CATALOG.length < 3) {
  console.error('❌ ERROR: Catalog must have at least 3 styles');
  process.exit(1);
}

// Validate required styles exist
const requiredStyles = ['corporate-blue', 'warm-studio', 'professional-gray'];
const styleIds = getAllStyleIds();
console.log(`✓ Style IDs: ${styleIds.join(', ')}`);

for (const requiredId of requiredStyles) {
  if (!styleIds.includes(requiredId)) {
    console.error(`❌ ERROR: Missing required style: ${requiredId}`);
    process.exit(1);
  }
  console.log(`✓ Found required style: ${requiredId}`);
}

// Validate unique IDs
const uniqueIds = new Set(styleIds);
if (uniqueIds.size !== styleIds.length) {
  console.error('❌ ERROR: Duplicate style IDs found');
  process.exit(1);
}
console.log('✓ All style IDs are unique');

// Validate unique seeds
const seeds = STYLE_CATALOG.map(s => s.seed);
const uniqueSeeds = new Set(seeds);
if (uniqueSeeds.size !== seeds.length) {
  console.error('❌ ERROR: Duplicate seeds found');
  process.exit(1);
}
console.log('✓ All seeds are unique');

// Validate each style has required fields
console.log('\n📋 Validating style fields...');
for (const style of STYLE_CATALOG) {
  if (!style.id || !style.name || !style.description || !style.prompt || 
      !style.negativePrompt || typeof style.seed !== 'number' || 
      !style.previewImage || !style.category) {
    console.error(`❌ ERROR: Style ${style.id} is missing required fields`);
    process.exit(1);
  }
  console.log(`✓ ${style.name} (${style.id}) - seed: ${style.seed}`);
}

// Test helper functions
console.log('\n🔧 Testing helper functions...');

// Test getStyleById
const corporateBlue = getStyleById('corporate-blue');
if (!corporateBlue || corporateBlue.id !== 'corporate-blue') {
  console.error('❌ ERROR: getStyleById failed');
  process.exit(1);
}
console.log('✓ getStyleById works correctly');

// Test getStylesByCategory
const corporateStyles = getStylesByCategory('corporate');
if (corporateStyles.length === 0) {
  console.error('❌ ERROR: getStylesByCategory failed');
  process.exit(1);
}
console.log(`✓ getStylesByCategory found ${corporateStyles.length} corporate styles`);

// Test isValidStyleId
if (!isValidStyleId('corporate-blue') || isValidStyleId('invalid-id')) {
  console.error('❌ ERROR: isValidStyleId failed');
  process.exit(1);
}
console.log('✓ isValidStyleId works correctly');

// Test getDefaultStyle
const defaultStyle = getDefaultStyle();
if (defaultStyle.id !== 'corporate-blue') {
  console.error('❌ ERROR: getDefaultStyle failed');
  process.exit(1);
}
console.log('✓ getDefaultStyle returns Corporate Blue');

// Test buildNegativePrompt
const testStyle = STYLE_CATALOG[0];
const basePrompt = buildNegativePrompt(testStyle);
const customPrompt = buildNegativePrompt(testStyle, {
  removeJewelry: true,
  removeGlasses: true,
});

if (!basePrompt.includes(testStyle.negativePrompt)) {
  console.error('❌ ERROR: buildNegativePrompt failed for base prompt');
  process.exit(1);
}

if (!customPrompt.includes('jewelry') || !customPrompt.includes('glasses')) {
  console.error('❌ ERROR: buildNegativePrompt failed for customizations');
  process.exit(1);
}
console.log('✓ buildNegativePrompt works correctly');

console.log('\n✅ All validations passed!');
console.log('\n📊 Summary:');
console.log(`   - Total styles: ${STYLE_CATALOG.length}`);
console.log(`   - Corporate styles: ${getStylesByCategory('corporate').length}`);
console.log(`   - Creative styles: ${getStylesByCategory('creative').length}`);
console.log(`   - Casual styles: ${getStylesByCategory('casual').length}`);
