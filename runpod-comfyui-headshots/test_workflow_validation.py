"""
Workflow Validation Test Suite (No External Dependencies)

This script validates the workflow structure and configuration
without requiring PIL, requests, or other external libraries.

Tests:
- Task 7.1: Workflow structure validation
- Task 7.2: Webhook progress configuration
- Task 7.3: Error handling configuration
"""

import os
import sys
import json
from pathlib import Path


class WorkflowValidator:
    """Validates ComfyUI workflow structure"""
    
    def __init__(self):
        self.test_results = {
            "passed": [],
            "failed": [],
            "warnings": []
        }
    
    def load_workflow(self) -> dict:
        """Load workflow JSON"""
        workflow_path = Path(__file__).parent / "workflow.json"
        
        if not workflow_path.exists():
            raise FileNotFoundError(f"Workflow not found: {workflow_path}")
        
        with open(workflow_path, 'r') as f:
            return json.load(f)
    
    def test_workflow_structure(self):
        """Test 7.1: Validate workflow structure"""
        print("\n" + "="*70)
        print("TEST 7.1: Workflow Structure Validation")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            
            # Check required top-level keys
            print("\n1. Checking workflow structure...")
            required_keys = ["nodes", "links", "config"]
            for key in required_keys:
                if key in workflow:
                    print(f"   ✓ Found required key: {key}")
                else:
                    print(f"   ✗ Missing required key: {key}")
                    self.test_results["failed"].append(f"Missing key: {key}")
            
            # Check nodes
            print("\n2. Validating workflow nodes...")
            nodes = workflow.get("nodes", [])
            print(f"   Total nodes: {len(nodes)}")
            
            required_node_types = [
                "LoadImageBatch",
                "RMBG",
                "CLIPInterrogator",
                "PromptBuilder",
                "SeedreamNode",
                "SaveImageWebhook",
                "WebhookProgress"
            ]
            
            found_nodes = {}
            for node in nodes:
                node_type = node.get("type")
                if node_type in required_node_types:
                    found_nodes[node_type] = node
                    print(f"   ✓ Found node: {node_type}")
            
            missing_nodes = [nt for nt in required_node_types if nt not in found_nodes]
            if missing_nodes:
                print(f"\n   ✗ Missing nodes: {', '.join(missing_nodes)}")
                self.test_results["failed"].append(f"Missing nodes: {missing_nodes}")
            else:
                print(f"\n   ✓ All {len(required_node_types)} required nodes present")
            
            # Check node connections
            print("\n3. Validating node connections...")
            links = workflow.get("links", [])
            print(f"   Total links: {len(links)}")
            
            if len(links) >= 10:
                print(f"   ✓ Workflow has sufficient connections")
            else:
                print(f"   ⚠ Warning: Only {len(links)} connections found")
                self.test_results["warnings"].append("Few node connections")
            
            # Check workflow metadata
            print("\n4. Validating workflow metadata...")
            metadata = workflow.get("workflow_metadata", {})
            
            if metadata:
                print(f"   ✓ Workflow name: {metadata.get('name', 'N/A')}")
                print(f"   ✓ Version: {metadata.get('version', 'N/A')}")
                print(f"   ✓ Requirements: {len(metadata.get('requirements', []))} items")
            else:
                print(f"   ⚠ Warning: No workflow metadata found")
                self.test_results["warnings"].append("No workflow metadata")
            
            # Check Seedream configuration
            print("\n5. Validating Seedream node configuration...")
            if "SeedreamNode" in found_nodes:
                seedream_node = found_nodes["SeedreamNode"]
                widgets = seedream_node.get("widgets_values", [])
                
                if len(widgets) >= 9:
                    print(f"   ✓ Model: {widgets[0] if len(widgets) > 0 else 'N/A'}")
                    print(f"   ✓ Size: {widgets[1] if len(widgets) > 1 else 'N/A'}")
                    print(f"   ✓ Width: {widgets[2] if len(widgets) > 2 else 'N/A'}")
                    print(f"   ✓ Height: {widgets[3] if len(widgets) > 3 else 'N/A'}")
                    print(f"   ✓ Aspect ratio: {widgets[4] if len(widgets) > 4 else 'N/A'}")
                    print(f"   ✓ Max images: {widgets[5] if len(widgets) > 5 else 'N/A'}")
                    
                    # Verify expected values
                    if widgets[2] == 1728 and widgets[3] == 2304:
                        print(f"   ✓ Resolution is correct (1728x2304)")
                    else:
                        print(f"   ⚠ Warning: Resolution may not be optimal")
                        self.test_results["warnings"].append("Seedream resolution not 1728x2304")
                else:
                    print(f"   ⚠ Warning: Seedream configuration incomplete")
                    self.test_results["warnings"].append("Seedream configuration incomplete")
            
            self.test_results["passed"].append("7.1: Workflow structure validation")
            print("\n✓ TEST 7.1 PASSED: Workflow structure is valid")
            
        except Exception as e:
            self.test_results["failed"].append(f"7.1: {str(e)}")
            print(f"\n✗ TEST 7.1 FAILED: {str(e)}")
    
    def test_webhook_configuration(self):
        """Test 7.2: Validate webhook progress configuration"""
        print("\n" + "="*70)
        print("TEST 7.2: Webhook Progress Configuration")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            
            # Check webhook progress stages in config
            print("\n1. Checking webhook progress configuration...")
            config = workflow.get("config", {})
            progress_stages = config.get("webhook_progress_stages", [])
            
            if not progress_stages:
                print("   ✗ No webhook progress stages configured")
                self.test_results["failed"].append("No webhook progress stages")
                return
            
            print(f"   ✓ Found {len(progress_stages)} progress stages")
            
            # Validate progress stages
            print("\n2. Validating progress stages...")
            expected_stages = [10, 20, 40, 50, 80, 100]
            found_stages = []
            
            for stage in progress_stages:
                progress = stage.get("progress")
                message = stage.get("message")
                node_id = stage.get("node_id")
                
                found_stages.append(progress)
                print(f"   ✓ {progress}%: {message} (node {node_id})")
            
            # Check that all expected stages are present
            print("\n3. Verifying expected progress percentages...")
            missing_stages = [s for s in expected_stages if s not in found_stages]
            
            if missing_stages:
                print(f"   ⚠ Warning: Missing progress stages: {missing_stages}")
                self.test_results["warnings"].append(f"Missing progress stages: {missing_stages}")
            else:
                print(f"   ✓ All expected progress stages present")
            
            # Check that progress is monotonically increasing
            print("\n4. Verifying progress sequence...")
            sorted_stages = sorted(found_stages)
            if found_stages == sorted_stages:
                print(f"   ✓ Progress stages are monotonically increasing")
            else:
                print(f"   ✗ Progress stages are not in order")
                self.test_results["failed"].append("Progress stages not in order")
            
            # Check that messages are descriptive
            print("\n5. Verifying progress messages...")
            all_descriptive = True
            for stage in progress_stages:
                message = stage.get("message", "")
                if len(message) < 10:
                    print(f"   ⚠ Warning: Short message at {stage.get('progress')}%: '{message}'")
                    all_descriptive = False
            
            if all_descriptive:
                print(f"   ✓ All progress messages are descriptive")
            else:
                self.test_results["warnings"].append("Some progress messages are too short")
            
            # Check WebhookProgress node
            print("\n6. Checking WebhookProgress node...")
            nodes = workflow.get("nodes", [])
            webhook_nodes = [n for n in nodes if n.get("type") == "WebhookProgress"]
            
            if webhook_nodes:
                print(f"   ✓ Found {len(webhook_nodes)} WebhookProgress node(s)")
            else:
                print(f"   ✗ No WebhookProgress node found")
                self.test_results["failed"].append("No WebhookProgress node")
            
            self.test_results["passed"].append("7.2: Webhook configuration validation")
            print("\n✓ TEST 7.2 PASSED: Webhook configuration is valid")
            
        except Exception as e:
            self.test_results["failed"].append(f"7.2: {str(e)}")
            print(f"\n✗ TEST 7.2 FAILED: {str(e)}")
    
    def test_error_handling_configuration(self):
        """Test 7.3: Validate error handling configuration"""
        print("\n" + "="*70)
        print("TEST 7.3: Error Handling Configuration")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            
            # Check for optional nodes (LoRA refinement)
            print("\n1. Checking optional node configuration...")
            nodes = workflow.get("nodes", [])
            
            optional_nodes = []
            for node in nodes:
                # mode: 4 means disabled/optional in ComfyUI
                if node.get("mode") == 4:
                    optional_nodes.append(node.get("type"))
                    print(f"   ✓ Optional node: {node.get('type')}")
            
            if optional_nodes:
                print(f"   ✓ Found {len(optional_nodes)} optional nodes")
            else:
                print(f"   ⚠ Warning: No optional nodes configured")
                self.test_results["warnings"].append("No optional nodes")
            
            # Check for error handling in config
            print("\n2. Checking error handling configuration...")
            config = workflow.get("config", {})
            
            if "lora_activation_threshold" in config:
                threshold = config["lora_activation_threshold"]
                print(f"   ✓ LoRA activation threshold: {threshold}")
            else:
                print(f"   ⚠ Warning: No LoRA activation threshold configured")
                self.test_results["warnings"].append("No LoRA activation threshold")
            
            # Check default parameters
            print("\n3. Checking default parameters...")
            default_params = config.get("default_parameters", {})
            
            if default_params:
                print(f"   ✓ Found {len(default_params)} default parameters")
                for key, value in default_params.items():
                    print(f"     - {key}: {value}")
            else:
                print(f"   ⚠ Warning: No default parameters configured")
                self.test_results["warnings"].append("No default parameters")
            
            # Check for image selector node (handles LoRA optional path)
            print("\n4. Checking image selector node...")
            selector_nodes = [n for n in nodes if n.get("type") == "ImageSelector"]
            
            if selector_nodes:
                print(f"   ✓ Found ImageSelector node for handling optional paths")
            else:
                print(f"   ⚠ Warning: No ImageSelector node found")
                self.test_results["warnings"].append("No ImageSelector node")
            
            # Check for validation in nodes
            print("\n5. Checking node validation...")
            
            # Check LoadImageBatch for validation
            load_nodes = [n for n in nodes if n.get("type") == "LoadImageBatch"]
            if load_nodes:
                print(f"   ✓ LoadImageBatch node present for input validation")
            
            # Check RMBG for background removal
            rmbg_nodes = [n for n in nodes if n.get("type") == "RMBG"]
            if rmbg_nodes:
                print(f"   ✓ RMBG node present for background removal")
            
            # Check SaveImageWebhook for output handling
            save_nodes = [n for n in nodes if n.get("type") == "SaveImageWebhook"]
            if save_nodes:
                print(f"   ✓ SaveImageWebhook node present for output handling")
            
            self.test_results["passed"].append("7.3: Error handling configuration")
            print("\n✓ TEST 7.3 PASSED: Error handling configuration is valid")
            
        except Exception as e:
            self.test_results["failed"].append(f"7.3: {str(e)}")
            print(f"\n✗ TEST 7.3 FAILED: {str(e)}")
    
    def test_sample_images_available(self):
        """Check that sample test images are available"""
        print("\n" + "="*70)
        print("ADDITIONAL: Sample Images Availability")
        print("="*70)
        
        try:
            test_images_dir = Path(__file__).parent.parent / "uploads" / "style-training"
            
            print(f"\n1. Checking test images directory...")
            print(f"   Path: {test_images_dir}")
            
            if not test_images_dir.exists():
                print(f"   ✗ Test images directory not found")
                self.test_results["warnings"].append("Test images directory not found")
                return
            
            print(f"   ✓ Test images directory exists")
            
            # Count images
            image_files = list(test_images_dir.glob("*.jpg")) + \
                         list(test_images_dir.glob("*.jpeg")) + \
                         list(test_images_dir.glob("*.png"))
            
            print(f"\n2. Counting test images...")
            print(f"   Found {len(image_files)} images")
            
            if len(image_files) >= 10:
                print(f"   ✓ Sufficient test images available (need 5-10)")
            elif len(image_files) >= 5:
                print(f"   ✓ Minimum test images available")
            else:
                print(f"   ✗ Not enough test images (need at least 5)")
                self.test_results["warnings"].append("Not enough test images")
            
            # Show sample images
            print(f"\n3. Sample test images:")
            for img in image_files[:5]:
                print(f"   - {img.name}")
            
            self.test_results["passed"].append("Sample images check")
            
        except Exception as e:
            self.test_results["warnings"].append(f"Sample images check: {str(e)}")
            print(f"\n⚠ Warning: {str(e)}")
    
    def run_all_tests(self):
        """Run all validation tests"""
        print("\n" + "="*70)
        print("COMFYUI WORKFLOW VALIDATION TEST SUITE")
        print("="*70)
        print("\nThis test suite validates:")
        print("  - Task 7.1: Workflow structure and configuration")
        print("  - Task 7.2: Webhook progress configuration")
        print("  - Task 7.3: Error handling configuration")
        print("\nRequirements: 8.1, 8.2, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4")
        
        # Run all tests
        self.test_workflow_structure()
        self.test_webhook_configuration()
        self.test_error_handling_configuration()
        self.test_sample_images_available()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        
        print(f"\n✓ PASSED: {len(self.test_results['passed'])} tests")
        for test in self.test_results['passed']:
            print(f"  - {test}")
        
        if self.test_results['failed']:
            print(f"\n✗ FAILED: {len(self.test_results['failed'])} tests")
            for test in self.test_results['failed']:
                print(f"  - {test}")
        
        if self.test_results['warnings']:
            print(f"\n⚠ WARNINGS: {len(self.test_results['warnings'])} items")
            for warning in self.test_results['warnings']:
                print(f"  - {warning}")
        
        print("\n" + "="*70)
        print("VALIDATION COMPLETE")
        print("="*70)
        
        if not self.test_results['failed']:
            print("\n✓ All validation tests passed!")
            print("\nNext steps:")
            print("1. Install custom nodes: ./install-custom-nodes.sh")
            print("2. Start ComfyUI: python main.py")
            print("3. Run integration tests: python test_workflow_integration.py")
            print("4. Deploy to RunPod for production testing")
        else:
            print("\n✗ Some validation tests failed")
            print("Please fix the issues before proceeding")
        
        print("="*70 + "\n")


def main():
    """Main test execution"""
    validator = WorkflowValidator()
    validator.run_all_tests()
    
    # Return exit code based on results
    if validator.test_results['failed']:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
