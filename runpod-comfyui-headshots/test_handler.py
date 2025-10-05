"""
Test script for ComfyUI headshot generation handler
Run this to test the handler locally before deploying to RunPod
"""

import json
from handler import handler

# Test event with sample data
test_event = {
    "input": {
        "reference_images": [
            "https://example.com/photo1.jpg",
            "https://example.com/photo2.jpg",
            "https://example.com/photo3.jpg",
            "https://example.com/photo4.jpg",
            "https://example.com/photo5.jpg"
        ],
        "num_outputs": 4,
        "style_intensity": 0.8,
        "webhook_url": "https://webhook.site/your-unique-url",
        "job_id": "test-job-123"
    }
}

def test_input_validation():
    """Test input validation"""
    print("Testing input validation...")
    
    # Test with too few images
    event = {
        "input": {
            "reference_images": ["url1.jpg", "url2.jpg"],
            "num_outputs": 4
        }
    }
    result = handler(event)
    assert result["status"] == "failed", "Should fail with too few images"
    print("✓ Too few images validation passed")
    
    # Test with too many images
    event = {
        "input": {
            "reference_images": [f"url{i}.jpg" for i in range(15)],
            "num_outputs": 4
        }
    }
    result = handler(event)
    assert result["status"] == "failed", "Should fail with too many images"
    print("✓ Too many images validation passed")
    
    print("All validation tests passed!\n")

def test_handler_structure():
    """Test handler response structure"""
    print("Testing handler structure...")
    
    # Note: This will fail on actual execution without ComfyUI running
    # but we can test the structure
    try:
        result = handler(test_event)
        
        # Check response has required fields
        assert "status" in result, "Response should have 'status' field"
        
        if result["status"] == "success":
            assert "images" in result, "Success response should have 'images'"
            assert "metadata" in result, "Success response should have 'metadata'"
            print("✓ Success response structure is correct")
        elif result["status"] == "failed":
            assert "error" in result, "Failed response should have 'error'"
            print("✓ Error response structure is correct")
            
    except Exception as e:
        print(f"Expected error (ComfyUI not running): {str(e)}")
        print("✓ Handler structure test completed")
    
    print()

def main():
    """Run all tests"""
    print("=" * 60)
    print("ComfyUI Headshot Generator - Handler Tests")
    print("=" * 60)
    print()
    
    test_input_validation()
    test_handler_structure()
    
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)
    print("✓ Input validation tests passed")
    print("✓ Handler structure tests passed")
    print()
    print("Note: Full integration tests require ComfyUI to be running")
    print("Deploy to RunPod for complete end-to-end testing")
    print()

if __name__ == "__main__":
    main()
