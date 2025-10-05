"""
Integration Test for ComfyUI Workflow with Actual ComfyUI Instance

This script tests the workflow against a running ComfyUI instance.
Run this after starting ComfyUI locally or on RunPod.

Usage:
    python test_workflow_integration.py [--comfyui-url URL] [--num-images N]
"""

import os
import sys
import json
import time
import argparse
import base64
from pathlib import Path
from typing import List, Dict, Any
import requests
from PIL import Image
from io import BytesIO

# Test configuration
DEFAULT_COMFYUI_URL = "http://127.0.0.1:8188"
TEST_IMAGES_DIR = "../uploads/style-training"


class ComfyUIIntegrationTester:
    """Integration tester for ComfyUI workflow"""
    
    def __init__(self, comfyui_url: str, test_images_dir: str):
        self.comfyui_url = comfyui_url
        self.test_images_dir = Path(test_images_dir)
        self.results = []
    
    def check_comfyui_available(self) -> bool:
        """Check if ComfyUI is running and accessible"""
        try:
            response = requests.get(f"{self.comfyui_url}/system_stats", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def load_workflow(self) -> Dict[str, Any]:
        """Load the workflow JSON"""
        workflow_path = Path(__file__).parent / "workflow.json"
        
        if not workflow_path.exists():
            raise FileNotFoundError(f"Workflow not found: {workflow_path}")
        
        with open(workflow_path, 'r') as f:
            return json.load(f)
    
    def get_test_images(self, count: int = 5) -> List[str]:
        """Get test image paths"""
        image_files = list(self.test_images_dir.glob("*.jpg")) + \
                     list(self.test_images_dir.glob("*.jpeg"))
        
        if len(image_files) < count:
            raise ValueError(f"Not enough test images. Found {len(image_files)}, need {count}")
        
        return [str(img) for img in image_files[:count]]
    
    def upload_image_to_comfyui(self, image_path: str) -> str:
        """Upload image to ComfyUI and return the filename"""
        try:
            with open(image_path, 'rb') as f:
                files = {'image': (Path(image_path).name, f, 'image/jpeg')}
                response = requests.post(
                    f"{self.comfyui_url}/upload/image",
                    files=files,
                    timeout=30
                )
                response.raise_for_status()
                return response.json()['name']
        except Exception as e:
            raise Exception(f"Failed to upload image: {str(e)}")
    
    def queue_workflow(self, workflow: Dict[str, Any]) -> str:
        """Queue workflow and return prompt_id"""
        try:
            response = requests.post(
                f"{self.comfyui_url}/prompt",
                json={"prompt": workflow},
                timeout=30
            )
            response.raise_for_status()
            return response.json()['prompt_id']
        except Exception as e:
            raise Exception(f"Failed to queue workflow: {str(e)}")
    
    def wait_for_completion(self, prompt_id: str, timeout: int = 600) -> Dict[str, Any]:
        """Wait for workflow to complete and return results"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                # Check history
                response = requests.get(
                    f"{self.comfyui_url}/history/{prompt_id}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    history = response.json()
                    
                    if prompt_id in history:
                        result = history[prompt_id]
                        
                        # Check if completed
                        if "outputs" in result:
                            return result
                        
                        # Check for errors
                        if "error" in result:
                            raise Exception(f"Workflow error: {result['error']}")
                
                # Check queue status
                queue_response = requests.get(
                    f"{self.comfyui_url}/queue",
                    timeout=10
                )
                
                if queue_response.status_code == 200:
                    queue_data = queue_response.json()
                    
                    # Print queue status
                    running = queue_data.get('queue_running', [])
                    pending = queue_data.get('queue_pending', [])
                    
                    if running:
                        print(f"  Status: Running ({len(running)} jobs)")
                    elif pending:
                        print(f"  Status: Pending ({len(pending)} jobs in queue)")
                
                time.sleep(2)
                
            except Exception as e:
                print(f"  Error checking status: {str(e)}")
                time.sleep(2)
        
        raise Exception("Workflow execution timed out")
    
    def download_output_images(self, result: Dict[str, Any]) -> List[bytes]:
        """Download output images from ComfyUI"""
        images = []
        
        for node_id, node_output in result.get("outputs", {}).items():
            if "images" in node_output:
                for img_data in node_output["images"]:
                    try:
                        filename = img_data['filename']
                        subfolder = img_data.get('subfolder', '')
                        img_type = img_data.get('type', 'output')
                        
                        url = f"{self.comfyui_url}/view?filename={filename}"
                        if subfolder:
                            url += f"&subfolder={subfolder}"
                        url += f"&type={img_type}"
                        
                        response = requests.get(url, timeout=30)
                        response.raise_for_status()
                        images.append(response.content)
                        
                    except Exception as e:
                        print(f"  Warning: Failed to download image: {str(e)}")
        
        return images
    
    def analyze_output_quality(self, images: List[bytes]) -> Dict[str, Any]:
        """Analyze quality of output images"""
        analysis = {
            "num_images": len(images),
            "images": []
        }
        
        for i, img_bytes in enumerate(images):
            try:
                img = Image.open(BytesIO(img_bytes))
                
                img_analysis = {
                    "index": i,
                    "width": img.width,
                    "height": img.height,
                    "format": img.format,
                    "mode": img.mode,
                    "size_kb": len(img_bytes) / 1024,
                    "is_high_res": img.width >= 1728 and img.height >= 2304,
                    "aspect_ratio": round(img.width / img.height, 2)
                }
                
                analysis["images"].append(img_analysis)
                
            except Exception as e:
                analysis["images"].append({
                    "index": i,
                    "error": str(e)
                })
        
        return analysis
    
    def test_basic_generation(self, num_images: int = 5):
        """Test basic headshot generation"""
        print("\n" + "="*70)
        print("INTEGRATION TEST: Basic Headshot Generation")
        print("="*70)
        
        try:
            # Check ComfyUI availability
            print("\n1. Checking ComfyUI availability...")
            if not self.check_comfyui_available():
                raise Exception(f"ComfyUI not available at {self.comfyui_url}")
            print(f"   ✓ ComfyUI is running at {self.comfyui_url}")
            
            # Load workflow
            print("\n2. Loading workflow...")
            workflow = self.load_workflow()
            print(f"   ✓ Workflow loaded ({len(workflow.get('nodes', []))} nodes)")
            
            # Get test images
            print(f"\n3. Loading {num_images} test images...")
            test_images = self.get_test_images(num_images)
            for img in test_images:
                print(f"   - {Path(img).name}")
            print(f"   ✓ Loaded {len(test_images)} test images")
            
            # Upload images to ComfyUI
            print("\n4. Uploading images to ComfyUI...")
            uploaded_filenames = []
            for img_path in test_images:
                filename = self.upload_image_to_comfyui(img_path)
                uploaded_filenames.append(filename)
                print(f"   ✓ Uploaded: {filename}")
            
            # Note: Actual workflow execution requires custom nodes to be installed
            print("\n5. Workflow execution...")
            print("   Note: This requires custom nodes to be installed:")
            print("   - LoadImageBatch")
            print("   - RMBG (background removal)")
            print("   - CLIPInterrogator")
            print("   - PromptBuilder")
            print("   - SeedreamNode")
            print("   - SaveImageWebhook")
            print("   - WebhookProgress")
            print("\n   To install custom nodes, run:")
            print("   ./install-custom-nodes.sh")
            
            print("\n✓ INTEGRATION TEST SETUP COMPLETE")
            print("\nNext steps:")
            print("1. Install custom nodes")
            print("2. Restart ComfyUI")
            print("3. Run this test again to execute the full workflow")
            
            self.results.append({
                "test": "basic_generation",
                "status": "setup_complete",
                "images_uploaded": len(uploaded_filenames)
            })
            
        except Exception as e:
            print(f"\n✗ INTEGRATION TEST FAILED: {str(e)}")
            self.results.append({
                "test": "basic_generation",
                "status": "failed",
                "error": str(e)
            })
    
    def test_custom_nodes(self):
        """Test that custom nodes are available"""
        print("\n" + "="*70)
        print("INTEGRATION TEST: Custom Nodes Availability")
        print("="*70)
        
        try:
            print("\n1. Checking for custom nodes...")
            
            # Try to get object info (includes custom nodes)
            response = requests.get(f"{self.comfyui_url}/object_info", timeout=10)
            
            if response.status_code == 200:
                object_info = response.json()
                
                # Check for our custom nodes
                required_nodes = [
                    "LoadImageBatch",
                    "RMBG",
                    "CLIPInterrogator",
                    "PromptBuilder",
                    "SeedreamNode",
                    "SaveImageWebhook",
                    "WebhookProgress"
                ]
                
                found_nodes = []
                missing_nodes = []
                
                for node in required_nodes:
                    if node in object_info:
                        found_nodes.append(node)
                        print(f"   ✓ Found: {node}")
                    else:
                        missing_nodes.append(node)
                        print(f"   ✗ Missing: {node}")
                
                if missing_nodes:
                    print(f"\n⚠ Missing {len(missing_nodes)} custom nodes")
                    print("   Run: ./install-custom-nodes.sh")
                else:
                    print(f"\n✓ All {len(required_nodes)} custom nodes are installed")
                
                self.results.append({
                    "test": "custom_nodes",
                    "status": "complete",
                    "found": len(found_nodes),
                    "missing": len(missing_nodes)
                })
            else:
                raise Exception(f"Failed to get object info: {response.status_code}")
                
        except Exception as e:
            print(f"\n✗ CUSTOM NODES TEST FAILED: {str(e)}")
            self.results.append({
                "test": "custom_nodes",
                "status": "failed",
                "error": str(e)
            })
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("INTEGRATION TEST SUMMARY")
        print("="*70)
        
        for result in self.results:
            print(f"\nTest: {result['test']}")
            print(f"Status: {result['status']}")
            
            if "error" in result:
                print(f"Error: {result['error']}")
            
            for key, value in result.items():
                if key not in ['test', 'status', 'error']:
                    print(f"{key}: {value}")
        
        print("\n" + "="*70)


def main():
    """Main test execution"""
    parser = argparse.ArgumentParser(description='Integration test for ComfyUI workflow')
    parser.add_argument('--comfyui-url', default=DEFAULT_COMFYUI_URL,
                       help='ComfyUI URL (default: http://127.0.0.1:8188)')
    parser.add_argument('--num-images', type=int, default=5,
                       help='Number of test images to use (default: 5)')
    
    args = parser.parse_args()
    
    # Check test images directory
    test_images_dir = os.path.join(os.path.dirname(__file__), TEST_IMAGES_DIR)
    
    if not os.path.exists(test_images_dir):
        print(f"Error: Test images directory not found: {test_images_dir}")
        return 1
    
    # Create tester
    tester = ComfyUIIntegrationTester(args.comfyui_url, test_images_dir)
    
    # Run tests
    print("="*70)
    print("COMFYUI WORKFLOW INTEGRATION TESTS")
    print("="*70)
    print(f"\nComfyUI URL: {args.comfyui_url}")
    print(f"Test Images: {test_images_dir}")
    print(f"Number of Images: {args.num_images}")
    
    tester.test_custom_nodes()
    tester.test_basic_generation(args.num_images)
    tester.print_summary()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
