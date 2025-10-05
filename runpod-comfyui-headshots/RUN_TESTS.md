# How to Run ComfyUI Workflow Tests

Quick reference guide for running all test suites.

---

## Quick Start

### Run All Validation Tests (No Dependencies Required)
```bash
# Run all three validation tests
python3 test_workflow_validation.py
python3 test_webhook_progress.py
python3 test_error_scenarios.py
```

**Expected Time:** ~3 seconds total  
**Requirements:** Python 3.x only (no external packages)

---

## Test Suites

### 1. Workflow Structure Validation ✅
**File:** `test_workflow_validation.py`

**What it tests:**
- Workflow JSON structure
- Node configuration
- Seedream settings
- Sample images availability

**Run:**
```bash
python3 test_workflow_validation.py
```

**Expected Output:**
```
✓ TEST 7.1 PASSED: Workflow structure is valid
✓ TEST 7.2 PASSED: Webhook configuration is valid
✓ TEST 7.3 PASSED: Error handling configuration is valid
✓ All validation tests passed!
```

---

### 2. Webhook Progress Testing ✅
**File:** `test_webhook_progress.py`

**What it tests:**
- Progress stages (10%, 20%, 40%, 50%, 80%, 100%)
- Progress monotonicity
- Message descriptiveness
- Webhook node configuration

**Run:**
```bash
python3 test_webhook_progress.py
```

**Expected Output:**
```
✓ ALL WEBHOOK PROGRESS TESTS PASSED
✓ PASSED: 11 tests
⚠ WARNINGS: 1 items (short message at 100%)
```

---

### 3. Error Scenario Testing ✅
**File:** `test_error_scenarios.py`

**What it tests:**
- Invalid URL handling
- No face detection
- NSFW filtering (documented)
- Graceful error handling
- Input validation
- Retry logic

**Run:**
```bash
python3 test_error_scenarios.py
```

**Expected Output:**
```
✓ Basic error handling is configured
✓ PASSED: 17 checks
⚠ WARNINGS: 2 items (NSFW filtering recommended)
```

---

### 4. End-to-End Simulation (Requires PIL)
**File:** `test_workflow_e2e.py`

**What it tests:**
- Full workflow simulation
- Sample photo processing
- Webhook capture
- Quality metrics

**Requirements:**
```bash
pip install Pillow requests
```

**Run:**
```bash
python3 test_workflow_e2e.py
```

---

### 5. Integration Testing (Requires ComfyUI)
**File:** `test_workflow_integration.py`

**What it tests:**
- ComfyUI availability
- Custom node installation
- Image upload
- Workflow execution

**Prerequisites:**
1. Start ComfyUI:
   ```bash
   cd ComfyUI
   python main.py
   ```

2. Install custom nodes:
   ```bash
   cd runpod-comfyui-headshots
   ./install-custom-nodes.sh
   ```

**Run:**
```bash
python3 test_workflow_integration.py --comfyui-url http://127.0.0.1:8188
```

**Options:**
- `--comfyui-url URL` - ComfyUI URL (default: http://127.0.0.1:8188)
- `--num-images N` - Number of test images (default: 5)

---

## Test Results

### Current Status

| Test Suite | Status | Tests | Warnings |
|-----------|--------|-------|----------|
| Workflow Validation | ✅ PASSED | 4/4 | 1 |
| Webhook Progress | ✅ PASSED | 11/11 | 1 |
| Error Scenarios | ✅ PASSED | 17/17 | 2 |
| **TOTAL** | **✅ PASSED** | **32/32** | **4** |

### Warnings (Non-Critical)

1. ⚠️ "Complete!" message is short (intentional)
2. ⚠️ NSFW filtering not implemented (recommended for production)

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'PIL'"
**Solution:** Install Pillow
```bash
pip install Pillow
```

### "ComfyUI not available"
**Solution:** Start ComfyUI first
```bash
cd ComfyUI
python main.py
```

### "Custom nodes not found"
**Solution:** Install custom nodes
```bash
./install-custom-nodes.sh
```

### "Test images directory not found"
**Solution:** Ensure you're in the correct directory
```bash
cd runpod-comfyui-headshots
python3 test_workflow_validation.py
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Test ComfyUI Workflow

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'
      
      - name: Run validation tests
        run: |
          cd runpod-comfyui-headshots
          python3 test_workflow_validation.py
          python3 test_webhook_progress.py
          python3 test_error_scenarios.py
```

---

## Test Coverage

### What's Tested ✅
- Workflow structure and configuration
- Node connections and settings
- Webhook progress updates
- Error handling and validation
- Input validation
- Timeout handling
- Retry logic

### What Requires Manual Testing 🔄
- Actual image generation quality
- Face consistency accuracy
- Style matching (DanDan aesthetic)
- Performance under load
- Cost per generation

### What's Not Implemented ⚠️
- NSFW content filtering (recommended for production)

---

## Next Steps

### Before Production
1. ✅ Run all validation tests (DONE)
2. 🔄 Install custom nodes on ComfyUI
3. 🔄 Run integration tests
4. ⚠️ Implement NSFW filtering
5. 📋 Deploy to RunPod
6. 📋 Test with real user photos

### Monitoring in Production
1. Track webhook delivery rates
2. Monitor error rates
3. Measure generation times
4. Collect quality metrics
5. Gather user feedback

---

## Quick Commands

```bash
# Run all validation tests
python3 test_workflow_validation.py && \
python3 test_webhook_progress.py && \
python3 test_error_scenarios.py

# Check test results
echo "All tests completed!"

# View test summary
cat TASK_7_TEST_SUMMARY.md
```

---

## Support

For issues or questions:
1. Check `TASK_7_TEST_SUMMARY.md` for detailed results
2. Review individual test scripts for specific checks
3. Check ComfyUI logs if integration tests fail
4. Verify custom nodes are installed correctly

---

**Last Updated:** January 2025  
**Test Coverage:** 32 tests, all passing ✅
