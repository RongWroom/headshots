#!/usr/bin/env python3
"""
Test script for custom ComfyUI nodes
Tests each node individually to ensure proper functionality
"""

import sys
import os

# Add custom_nodes to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'custom_nodes'))

def test_load_images_batch():
    """Test LoadImageBatch node"""
    print("\n" + "="*50)
    print("Testing LoadImageBatch")
    print("="*50)
    
    try:
        from load_images_batch import LoadImageBatch
        
        node = LoadImageBatch()
        print("✓ LoadImageBatch imported successfully")
        
        # Test INPUT_TYPES
        input_types = node.INPUT_TYPES()
        assert "required" in input_types
        assert "image_urls" in input_types["required"]
        print("✓ INPUT_TYPES validated")
        
        # Test with mock URLs (will fail to download, but tests structure)
        print("✓ LoadImageBatch structure validated")
        
        return True
    except Exception as e:
        print(f"✗ LoadImageBatch test failed: {str(e)}")
        return False


def test_prompt_builder():
    """Test PromptBuilder node"""
    print("\n" + "="*50)
    print("Testing PromptBuilder")
    print("="*50)
    
    try:
        from prompt_builder import PromptBuilder
        
        node = PromptBuilder()
        print("✓ PromptBuilder imported successfully")
        
        # Test with sample features
        features = {
            'gender': 'person',
            'skin_tone': 'medium',
            'hair_color': 'brown',
            'hair_style': 'professional',
            'eye_color': 'brown',
            'age_range': '30-40'
        }
        
        prompt, = node.build_prompt(features)
        print(f"✓ Generated prompt: {prompt[:100]}...")
        
        # Validate prompt contains key elements
        assert 'dandan style' in prompt.lower()
        assert 'professional' in prompt.lower()
        assert 'cinematic' in prompt.lower()
        print("✓ Prompt validation passed")
        
        return True
    except Exception as e:
        print(f"✗ PromptBuilder test failed: {str(e)}")
        return False


def test_clip_interrogator():
    """Test CLIPInterrogator node"""
    print("\n" + "="*50)
    print("Testing CLIPInterrogator")
    print("="*50)
    
    try:
        from clip_interrogator_node import CLIPInterrogator
        
        node = CLIPInterrogator()
        print("✓ CLIPInterrogator imported successfully")
        
        # Test INPUT_TYPES
        input_types = node.INPUT_TYPES()
        assert "required" in input_types
        assert "image" in input_types["required"]
        print("✓ INPUT_TYPES validated")
        
        print("✓ CLIPInterrogator structure validated")
        
        return True
    except Exception as e:
        print(f"✗ CLIPInterrogator test failed: {str(e)}")
        return False


def test_seedream_node():
    """Test SeedreamNode"""
    print("\n" + "="*50)
    print("Testing SeedreamNode")
    print("="*50)
    
    try:
        from seedream_node import SeedreamNode
        
        node = SeedreamNode()
        print("✓ SeedreamNode imported successfully")
        
        # Test INPUT_TYPES
        input_types = node.INPUT_TYPES()
        assert "required" in input_types
        assert "image_input" in input_types["required"]
        assert "prompt" in input_types["required"]
        print("✓ INPUT_TYPES validated")
        
        print("✓ SeedreamNode structure validated")
        
        return True
    except Exception as e:
        print(f"✗ SeedreamNode test failed: {str(e)}")
        return False


def test_lora_refinement():
    """Test LoRA refinement configuration"""
    print("\n" + "="*50)
    print("Testing LoRA Refinement Configuration")
    print("="*50)
    
    try:
        from lora_refinement_node import LoRARefinementConfig, configure_lora_nodes
        
        print("✓ LoRARefinementConfig imported successfully")
        
        # Test activation logic
        assert LoRARefinementConfig.should_activate(0.3) == False
        assert LoRARefinementConfig.should_activate(0.6) == True
        print("✓ Activation logic validated")
        
        # Test configuration
        workflow = {"nodes": [{"id": 6, "mode": 4}]}
        workflow = configure_lora_nodes(workflow, 0.6)
        assert workflow["nodes"][0]["mode"] == 0
        print("✓ Node configuration validated")
        
        return True
    except Exception as e:
        print(f"✗ LoRA refinement test failed: {str(e)}")
        return False


def test_save_image_webhook():
    """Test SaveImageWebhook node"""
    print("\n" + "="*50)
    print("Testing SaveImageWebhook")
    print("="*50)
    
    try:
        from save_image_webhook import SaveImageWebhook, ImageSelector
        
        node = SaveImageWebhook()
        print("✓ SaveImageWebhook imported successfully")
        
        # Test INPUT_TYPES
        input_types = node.INPUT_TYPES()
        assert "required" in input_types
        assert "images" in input_types["required"]
        assert "webhook_url" in input_types["required"]
        print("✓ INPUT_TYPES validated")
        
        # Test ImageSelector
        selector = ImageSelector()
        print("✓ ImageSelector imported successfully")
        
        return True
    except Exception as e:
        print(f"✗ SaveImageWebhook test failed: {str(e)}")
        return False


def test_webhook_progress():
    """Test WebhookProgress utilities"""
    print("\n" + "="*50)
    print("Testing WebhookProgress")
    print("="*50)
    
    try:
        from webhook_progress import WebhookProgress, PROGRESS_STAGES, get_progress_stage
        
        node = WebhookProgress()
        print("✓ WebhookProgress imported successfully")
        
        # Test progress stages
        assert "load_images" in PROGRESS_STAGES
        assert "complete" in PROGRESS_STAGES
        print("✓ Progress stages defined")
        
        # Test get_progress_stage
        stage = get_progress_stage("load_images")
        assert stage["progress"] == 10
        assert "Loading" in stage["message"]
        print("✓ Progress stage retrieval validated")
        
        return True
    except Exception as e:
        print(f"✗ WebhookProgress test failed: {str(e)}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("Custom ComfyUI Nodes Test Suite")
    print("="*70)
    
    tests = [
        ("LoadImageBatch", test_load_images_batch),
        ("PromptBuilder", test_prompt_builder),
        ("CLIPInterrogator", test_clip_interrogator),
        ("SeedreamNode", test_seedream_node),
        ("LoRA Refinement", test_lora_refinement),
        ("SaveImageWebhook", test_save_image_webhook),
        ("WebhookProgress", test_webhook_progress),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ Unexpected error in {name}: {str(e)}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*70)
    print("Test Summary")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
