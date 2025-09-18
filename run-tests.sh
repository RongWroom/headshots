#!/bin/bash

# Test runner script for the image upload and training pipeline
# Makes it easy to run all tests with proper setup

echo "🧪 Image Upload & Training Pipeline Test Suite"
echo "=============================================="
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "Please install Node.js to run the tests"
    exit 1
fi

# Set default base URL if not provided
if [ -z "$BASE_URL" ]; then
    export BASE_URL="http://localhost:3000"
    echo "🌐 Using default BASE_URL: $BASE_URL"
else
    echo "🌐 Using BASE_URL: $BASE_URL"
fi

echo ""

# Function to run a test file
run_test() {
    local test_file=$1
    local test_name=$2
    
    echo "▶️  Running $test_name..."
    echo "----------------------------------------"
    
    if [ -f "$test_file" ]; then
        node "$test_file"
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            echo "✅ $test_name completed"
        else
            echo "❌ $test_name failed with exit code $exit_code"
        fi
    else
        echo "❌ Test file not found: $test_file"
    fi
    
    echo ""
}

# Check what tests to run
case "${1:-all}" in
    "validation")
        echo "Running validation tests only..."
        run_test "test-validation-utilities.js" "Validation Utilities Tests"
        ;;
    "integration")
        echo "Running integration tests only..."
        run_test "test-upload-training-pipeline.js" "Integration Tests"
        ;;
    "complete")
        echo "Running complete test suite..."
        run_test "test-complete-pipeline.js" "Complete Pipeline Tests"
        ;;
    "all"|*)
        echo "Running all test suites..."
        echo ""
        
        # Run validation tests (unit tests - don't need server)
        run_test "test-validation-utilities.js" "Validation Utilities Tests"
        
        # Run integration tests (need server)
        run_test "test-upload-training-pipeline.js" "Integration Tests"
        
        # Run complete test suite
        run_test "test-complete-pipeline.js" "Complete Pipeline Tests"
        ;;
esac

echo "🏁 Test execution completed!"
echo ""
echo "📝 Usage:"
echo "  ./run-tests.sh                 # Run all tests"
echo "  ./run-tests.sh validation      # Run validation tests only"
echo "  ./run-tests.sh integration     # Run integration tests only"
echo "  ./run-tests.sh complete        # Run complete test suite"
echo ""
echo "💡 Tips:"
echo "  - Start dev server first: npm run dev"
echo "  - Set custom URL: BASE_URL=http://localhost:3000 ./run-tests.sh"
echo "  - Individual tests: node test-validation-utilities.js"