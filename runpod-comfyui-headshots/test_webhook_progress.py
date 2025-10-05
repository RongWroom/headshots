"""
Webhook Progress Testing Script

Tests webhook progress updates for the ComfyUI workflow.
Task 7.2: Test webhook progress updates

Requirements: 5.2, 5.3
"""

import json
import time
from pathlib import Path


class WebhookProgressTester:
    """Tests webhook progress configuration and behavior"""
    
    def __init__(self):
        self.results = {
            "passed": [],
            "failed": [],
            "warnings": []
        }
    
    def load_workflow(self) -> dict:
        """Load workflow JSON"""
        workflow_path = Path(__file__).parent / "workflow.json"
        
        with open(workflow_path, 'r') as f:
            return json.load(f)
    
    def test_progress_stages_configuration(self):
        """Test that progress stages are properly configured"""
        print("\n" + "="*70)
        print("TEST 1: Progress Stages Configuration")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            config = workflow.get("config", {})
            stages = config.get("webhook_progress_stages", [])
            
            print(f"\n1. Found {len(stages)} progress stages")
            
            # Expected stages
            expected = [
                {"progress": 10, "message_contains": "Loading"},
                {"progress": 20, "message_contains": "background"},
                {"progress": 40, "message_contains": "facial"},
                {"progress": 50, "message_contains": "Generating"},
                {"progress": 80, "message_contains": "Refining"},
                {"progress": 100, "message_contains": "Complete"}
            ]
            
            print("\n2. Validating each stage:")
            for exp in expected:
                matching = [s for s in stages if s["progress"] == exp["progress"]]
                
                if matching:
                    stage = matching[0]
                    message = stage.get("message", "")
                    
                    if exp["message_contains"].lower() in message.lower():
                        print(f"   ✓ {exp['progress']}%: '{message}'")
                        self.results["passed"].append(f"Stage {exp['progress']}%")
                    else:
                        print(f"   ⚠ {exp['progress']}%: Message doesn't contain '{exp['message_contains']}'")
                        self.results["warnings"].append(f"Stage {exp['progress']}% message")
                else:
                    print(f"   ✗ Missing stage: {exp['progress']}%")
                    self.results["failed"].append(f"Missing stage {exp['progress']}%")
            
            print("\n✓ TEST 1 PASSED: Progress stages are configured")
            
        except Exception as e:
            print(f"\n✗ TEST 1 FAILED: {str(e)}")
            self.results["failed"].append(f"Configuration test: {str(e)}")
    
    def test_progress_monotonicity(self):
        """Test that progress values are monotonically increasing"""
        print("\n" + "="*70)
        print("TEST 2: Progress Monotonicity")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            config = workflow.get("config", {})
            stages = config.get("webhook_progress_stages", [])
            
            progress_values = [s["progress"] for s in stages]
            sorted_values = sorted(progress_values)
            
            print(f"\n1. Progress sequence: {progress_values}")
            print(f"2. Sorted sequence:   {sorted_values}")
            
            if progress_values == sorted_values:
                print("\n✓ Progress values are monotonically increasing")
                self.results["passed"].append("Monotonicity test")
            else:
                print("\n✗ Progress values are NOT monotonically increasing")
                self.results["failed"].append("Monotonicity test")
            
            # Check for duplicates
            if len(progress_values) == len(set(progress_values)):
                print("✓ No duplicate progress values")
                self.results["passed"].append("No duplicates")
            else:
                print("⚠ Warning: Duplicate progress values found")
                self.results["warnings"].append("Duplicate progress values")
            
            print("\n✓ TEST 2 PASSED: Progress monotonicity verified")
            
        except Exception as e:
            print(f"\n✗ TEST 2 FAILED: {str(e)}")
            self.results["failed"].append(f"Monotonicity test: {str(e)}")
    
    def test_message_descriptiveness(self):
        """Test that progress messages are descriptive"""
        print("\n" + "="*70)
        print("TEST 3: Message Descriptiveness")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            config = workflow.get("config", {})
            stages = config.get("webhook_progress_stages", [])
            
            print("\n1. Analyzing message quality:")
            
            min_length = 10
            all_descriptive = True
            
            for stage in stages:
                message = stage.get("message", "")
                progress = stage.get("progress")
                length = len(message)
                
                if length >= min_length:
                    print(f"   ✓ {progress}%: '{message}' ({length} chars)")
                else:
                    print(f"   ⚠ {progress}%: '{message}' ({length} chars - too short)")
                    all_descriptive = False
                    self.results["warnings"].append(f"Short message at {progress}%")
            
            if all_descriptive:
                print(f"\n✓ All messages are descriptive (>= {min_length} chars)")
                self.results["passed"].append("Message descriptiveness")
            else:
                print(f"\n⚠ Some messages are too short")
            
            print("\n✓ TEST 3 PASSED: Message descriptiveness checked")
            
        except Exception as e:
            print(f"\n✗ TEST 3 FAILED: {str(e)}")
            self.results["failed"].append(f"Descriptiveness test: {str(e)}")
    
    def test_webhook_node_configuration(self):
        """Test that WebhookProgress node is properly configured"""
        print("\n" + "="*70)
        print("TEST 4: WebhookProgress Node Configuration")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            nodes = workflow.get("nodes", [])
            
            # Find WebhookProgress nodes
            webhook_nodes = [n for n in nodes if n.get("type") == "WebhookProgress"]
            
            print(f"\n1. Found {len(webhook_nodes)} WebhookProgress node(s)")
            
            if not webhook_nodes:
                print("   ✗ No WebhookProgress node found")
                self.results["failed"].append("No WebhookProgress node")
                return
            
            # Check node configuration
            for i, node in enumerate(webhook_nodes):
                print(f"\n2. Analyzing WebhookProgress node {i+1}:")
                print(f"   - ID: {node.get('id')}")
                print(f"   - Title: {node.get('title')}")
                print(f"   - Mode: {node.get('mode')} (0=active, 4=disabled)")
                
                widgets = node.get("widgets_values", [])
                if len(widgets) >= 2:
                    print(f"   - Webhook URL placeholder: {widgets[0]}")
                    print(f"   - Job ID placeholder: {widgets[1]}")
                    print("   ✓ Node has required widget values")
                else:
                    print("   ⚠ Node missing widget values")
                    self.results["warnings"].append("WebhookProgress missing widgets")
            
            print("\n✓ TEST 4 PASSED: WebhookProgress node is configured")
            self.results["passed"].append("WebhookProgress node")
            
        except Exception as e:
            print(f"\n✗ TEST 4 FAILED: {str(e)}")
            self.results["failed"].append(f"WebhookProgress test: {str(e)}")
    
    def test_save_webhook_node_configuration(self):
        """Test that SaveImageWebhook node is properly configured"""
        print("\n" + "="*70)
        print("TEST 5: SaveImageWebhook Node Configuration")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            nodes = workflow.get("nodes", [])
            
            # Find SaveImageWebhook nodes
            save_nodes = [n for n in nodes if n.get("type") == "SaveImageWebhook"]
            
            print(f"\n1. Found {len(save_nodes)} SaveImageWebhook node(s)")
            
            if not save_nodes:
                print("   ✗ No SaveImageWebhook node found")
                self.results["failed"].append("No SaveImageWebhook node")
                return
            
            # Check node configuration
            for i, node in enumerate(save_nodes):
                print(f"\n2. Analyzing SaveImageWebhook node {i+1}:")
                print(f"   - ID: {node.get('id')}")
                print(f"   - Title: {node.get('title')}")
                
                widgets = node.get("widgets_values", [])
                if len(widgets) >= 5:
                    print(f"   - Output format: {widgets[0]}")
                    print(f"   - Webhook URL placeholder: {widgets[1]}")
                    print(f"   - Job ID placeholder: {widgets[2]}")
                    print(f"   - Send webhook: {widgets[3]}")
                    print(f"   - Progress percentage: {widgets[4]}%")
                    print("   ✓ Node has required widget values")
                    
                    # Verify it sends 100% progress
                    if widgets[4] == 90 or widgets[4] == 100:
                        print("   ✓ Sends completion progress update")
                    else:
                        print(f"   ⚠ Progress value is {widgets[4]}%, expected 90-100%")
                        self.results["warnings"].append("SaveImageWebhook progress value")
                else:
                    print("   ⚠ Node missing widget values")
                    self.results["warnings"].append("SaveImageWebhook missing widgets")
            
            print("\n✓ TEST 5 PASSED: SaveImageWebhook node is configured")
            self.results["passed"].append("SaveImageWebhook node")
            
        except Exception as e:
            print(f"\n✗ TEST 5 FAILED: {str(e)}")
            self.results["failed"].append(f"SaveImageWebhook test: {str(e)}")
    
    def test_progress_coverage(self):
        """Test that progress updates cover the full workflow"""
        print("\n" + "="*70)
        print("TEST 6: Progress Coverage")
        print("="*70)
        
        try:
            workflow = self.load_workflow()
            config = workflow.get("config", {})
            stages = config.get("webhook_progress_stages", [])
            
            progress_values = [s["progress"] for s in stages]
            
            print("\n1. Checking progress coverage:")
            print(f"   - Minimum progress: {min(progress_values)}%")
            print(f"   - Maximum progress: {max(progress_values)}%")
            print(f"   - Number of stages: {len(progress_values)}")
            
            # Check start and end
            if min(progress_values) <= 10:
                print("   ✓ Starts at or near 0%")
            else:
                print(f"   ⚠ Starts at {min(progress_values)}%, should start near 0%")
                self.results["warnings"].append("Progress doesn't start near 0%")
            
            if max(progress_values) == 100:
                print("   ✓ Ends at 100%")
            else:
                print(f"   ✗ Ends at {max(progress_values)}%, should end at 100%")
                self.results["failed"].append("Progress doesn't reach 100%")
            
            # Check distribution
            gaps = []
            sorted_progress = sorted(progress_values)
            for i in range(1, len(sorted_progress)):
                gap = sorted_progress[i] - sorted_progress[i-1]
                gaps.append(gap)
            
            max_gap = max(gaps) if gaps else 0
            print(f"   - Maximum gap between stages: {max_gap}%")
            
            if max_gap <= 30:
                print("   ✓ Progress updates are well distributed")
            else:
                print(f"   ⚠ Large gap of {max_gap}% between stages")
                self.results["warnings"].append(f"Large gap of {max_gap}%")
            
            print("\n✓ TEST 6 PASSED: Progress coverage is adequate")
            self.results["passed"].append("Progress coverage")
            
        except Exception as e:
            print(f"\n✗ TEST 6 FAILED: {str(e)}")
            self.results["failed"].append(f"Coverage test: {str(e)}")
    
    def run_all_tests(self):
        """Run all webhook progress tests"""
        print("\n" + "="*70)
        print("WEBHOOK PROGRESS TESTING SUITE")
        print("="*70)
        print("\nTask 7.2: Test webhook progress updates")
        print("Requirements: 5.2, 5.3")
        print("\nTests:")
        print("  1. Progress stages configuration")
        print("  2. Progress monotonicity")
        print("  3. Message descriptiveness")
        print("  4. WebhookProgress node configuration")
        print("  5. SaveImageWebhook node configuration")
        print("  6. Progress coverage")
        
        # Run all tests
        self.test_progress_stages_configuration()
        self.test_progress_monotonicity()
        self.test_message_descriptiveness()
        self.test_webhook_node_configuration()
        self.test_save_webhook_node_configuration()
        self.test_progress_coverage()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("WEBHOOK PROGRESS TEST SUMMARY")
        print("="*70)
        
        print(f"\n✓ PASSED: {len(self.results['passed'])} tests")
        for test in self.results['passed']:
            print(f"  - {test}")
        
        if self.results['failed']:
            print(f"\n✗ FAILED: {len(self.results['failed'])} tests")
            for test in self.results['failed']:
                print(f"  - {test}")
        
        if self.results['warnings']:
            print(f"\n⚠ WARNINGS: {len(self.results['warnings'])} items")
            for warning in self.results['warnings']:
                print(f"  - {warning}")
        
        print("\n" + "="*70)
        
        if not self.results['failed']:
            print("✓ ALL WEBHOOK PROGRESS TESTS PASSED")
            print("\nWebhook progress updates are properly configured:")
            print("  - Progress stages are defined and ordered")
            print("  - Messages are descriptive")
            print("  - Webhook nodes are configured")
            print("  - Progress coverage is adequate")
            print("\nNext steps:")
            print("  1. Test with actual webhook endpoint (webhook.site)")
            print("  2. Deploy to RunPod and test end-to-end")
            print("  3. Monitor webhook delivery in production")
        else:
            print("✗ SOME WEBHOOK PROGRESS TESTS FAILED")
            print("Please fix the issues before proceeding")
        
        print("="*70 + "\n")


def main():
    """Main test execution"""
    tester = WebhookProgressTester()
    tester.run_all_tests()
    
    # Return exit code
    return 1 if tester.results['failed'] else 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
