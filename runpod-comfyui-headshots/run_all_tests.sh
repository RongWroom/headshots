#!/bin/bash

# Run All ComfyUI Workflow Tests
# This script runs all validation tests in sequence

# Change to script directory
cd "$(dirname "$0")"

echo "========================================================================"
echo "RUNNING ALL COMFYUI WORKFLOW TESTS"
echo "========================================================================"
echo ""

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test 1: Workflow Validation
echo "Running Test 1/3: Workflow Validation..."
python3 test_workflow_validation.py
TEST1_RESULT=$?
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ $TEST1_RESULT -eq 0 ]; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""
echo "------------------------------------------------------------------------"
echo ""

# Test 2: Webhook Progress
echo "Running Test 2/3: Webhook Progress..."
python3 test_webhook_progress.py
TEST2_RESULT=$?
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ $TEST2_RESULT -eq 0 ]; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""
echo "------------------------------------------------------------------------"
echo ""

# Test 3: Error Scenarios
echo "Running Test 3/3: Error Scenarios..."
python3 test_error_scenarios.py
TEST3_RESULT=$?
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ $TEST3_RESULT -eq 0 ]; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""
echo "========================================================================"
echo "ALL TESTS COMPLETE"
echo "========================================================================"
echo ""
echo "Results:"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $PASSED_TESTS"
echo "  Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ ALL TESTS PASSED!"
    echo ""
    echo "Next steps:"
    echo "  1. Install custom nodes: ./install-custom-nodes.sh"
    echo "  2. Start ComfyUI: python main.py"
    echo "  3. Run integration tests: python3 test_workflow_integration.py"
    exit 0
else
    echo "❌ SOME TESTS FAILED"
    echo ""
    echo "Please review the test output above and fix any issues."
    exit 1
fi
