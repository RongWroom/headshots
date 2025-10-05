#!/usr/bin/env python3
"""
Workflow Validation Script

This script validates the ComfyUI workflow JSON structure to ensure:
1. All required nodes are present
2. Node connections are valid
3. Progress stages are properly configured
4. Required parameters are set correctly
"""

import json
import sys
from typing import Dict, List, Set, Tuple


def load_workflow(filepath: str) -> Dict:
    """Load workflow JSON file."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: Workflow file not found: {filepath}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in workflow file: {e}")
        sys.exit(1)


def validate_required_nodes(workflow: Dict) -> Tuple[bool, List[str]]:
    """Validate that all required node types are present."""
    required_node_types = {
        'LoadImageBatch': 'Load Reference Images',
        'RMBG': 'Background Removal',
        'CLIPInterrogator': 'Face Analysis',
        'PromptBuilder': 'Prompt Builder',
        'SeedreamNode': 'Seedream Generation',
        'LoRALoader': 'LoRA Loader (Optional)',
        'SaveImageWebhook': 'Save & Webhook'
    }
    
    nodes = workflow.get('nodes', [])
    found_types = {node['type'] for node in nodes}
    
    missing = []
    for node_type, description in required_node_types.items():
        if node_type not in found_types:
            missing.append(f"{node_type} ({description})")
    
    if missing:
        return False, missing
    return True, []


def validate_node_connections(workflow: Dict) -> Tuple[bool, List[str]]:
    """Validate that nodes are properly connected."""
    nodes = workflow.get('nodes', [])
    links = workflow.get('links', [])
    
    errors = []
    
    # Build node ID map
    node_map = {node['id']: node for node in nodes}
    
    # Validate each link
    for link in links:
        link_id, from_node, from_slot, to_node, to_slot, data_type = link
        
        if from_node not in node_map:
            errors.append(f"Link {link_id}: Source node {from_node} not found")
        
        if to_node not in node_map:
            errors.append(f"Link {link_id}: Target node {to_node} not found")
    
    # Validate critical connections
    critical_connections = [
        ('LoadImageBatch', 'RMBG', 'IMAGE'),
        ('RMBG', 'CLIPInterrogator', 'IMAGE'),
        ('RMBG', 'SeedreamNode', 'IMAGE'),
        ('CLIPInterrogator', 'PromptBuilder', 'DICT'),
        ('PromptBuilder', 'SeedreamNode', 'STRING'),
        ('SeedreamNode', 'ImageSelector', 'IMAGE'),
        ('ImageSelector', 'SaveImageWebhook', 'IMAGE')
    ]
    
    for from_type, to_type, expected_data_type in critical_connections:
        connection_found = False
        for link in links:
            _, from_node_id, _, to_node_id, _, data_type = link
            from_node = node_map.get(from_node_id)
            to_node = node_map.get(to_node_id)
            
            if (from_node and to_node and 
                from_node['type'] == from_type and 
                to_node['type'] == to_type and
                data_type == expected_data_type):
                connection_found = True
                break
        
        if not connection_found:
            errors.append(
                f"Missing connection: {from_type} -> {to_type} ({expected_data_type})"
            )
    
    if errors:
        return False, errors
    return True, []


def validate_progress_stages(workflow: Dict) -> Tuple[bool, List[str]]:
    """Validate webhook progress configuration."""
    config = workflow.get('config', {})
    progress_stages = config.get('webhook_progress_stages', [])
    
    errors = []
    
    # Expected progress stages
    expected_stages = [
        (10, "Loading reference images..."),
        (20, "Removing backgrounds..."),
        (40, "Analyzing facial features..."),
        (50, "Generating professional headshots..."),
        (80, "Refining photography style..."),
        (100, "Complete!")
    ]
    
    if len(progress_stages) != len(expected_stages):
        errors.append(
            f"Expected {len(expected_stages)} progress stages, "
            f"found {len(progress_stages)}"
        )
    
    for i, (expected_progress, expected_message) in enumerate(expected_stages):
        if i < len(progress_stages):
            stage = progress_stages[i]
            if stage['progress'] != expected_progress:
                errors.append(
                    f"Stage {i}: Expected progress {expected_progress}%, "
                    f"found {stage['progress']}%"
                )
            if stage['message'] != expected_message:
                errors.append(
                    f"Stage {i}: Message mismatch. "
                    f"Expected: '{expected_message}', "
                    f"Found: '{stage['message']}'"
                )
    
    if errors:
        return False, errors
    return True, []


def validate_default_parameters(workflow: Dict) -> Tuple[bool, List[str]]:
    """Validate default parameter configuration."""
    config = workflow.get('config', {})
    params = config.get('default_parameters', {})
    
    errors = []
    
    # Expected parameters with their expected values
    expected_params = {
        'num_outputs': 4,
        'style_intensity': 0.8,
        'seedream_size': '2K',
        'seedream_width': 1728,
        'seedream_height': 2304,
        'seedream_aspect_ratio': '3:4',
        'seedream_prompt_strength': 0.85,
        'lora_strength': 0.35,
        'lora_denoise': 0.4
    }
    
    for param, expected_value in expected_params.items():
        if param not in params:
            errors.append(f"Missing parameter: {param}")
        elif params[param] != expected_value:
            errors.append(
                f"Parameter {param}: Expected {expected_value}, "
                f"found {params[param]}"
            )
    
    # Validate LoRA activation threshold
    threshold = config.get('lora_activation_threshold')
    if threshold != 0.5:
        errors.append(
            f"LoRA activation threshold: Expected 0.5, found {threshold}"
        )
    
    if errors:
        return False, errors
    return True, []


def validate_lora_nodes_disabled(workflow: Dict) -> Tuple[bool, List[str]]:
    """Validate that LoRA nodes are disabled by default."""
    nodes = workflow.get('nodes', [])
    
    errors = []
    
    # LoRA-related node IDs (6-11)
    lora_node_ids = [6, 7, 8, 9, 10, 11]
    
    for node in nodes:
        if node['id'] in lora_node_ids:
            if node.get('mode') != 4:
                errors.append(
                    f"Node {node['id']} ({node['type']}): "
                    f"Should be disabled (mode: 4), found mode: {node.get('mode')}"
                )
    
    if errors:
        return False, errors
    return True, []


def validate_metadata(workflow: Dict) -> Tuple[bool, List[str]]:
    """Validate workflow metadata."""
    metadata = workflow.get('workflow_metadata', {})
    
    errors = []
    
    required_fields = ['name', 'description', 'version', 'requirements']
    for field in required_fields:
        if field not in metadata:
            errors.append(f"Missing metadata field: {field}")
    
    # Validate requirements list
    requirements = metadata.get('requirements', [])
    expected_requirements = [
        'ComfyUI base installation',
        'RMBG custom node (background removal)',
        'CLIP Interrogator custom node',
        'Seedream 4.0 integration',
        'DanDan-Actor LoRA model',
        'Webhook support custom nodes'
    ]
    
    for req in expected_requirements:
        if req not in requirements:
            errors.append(f"Missing requirement: {req}")
    
    if errors:
        return False, errors
    return True, []


def main():
    """Run all validation checks."""
    print("🔍 Validating ComfyUI Workflow JSON...\n")
    
    workflow = load_workflow('workflow.json')
    
    all_passed = True
    
    # Run validation checks
    checks = [
        ("Required Nodes", validate_required_nodes),
        ("Node Connections", validate_node_connections),
        ("Progress Stages", validate_progress_stages),
        ("Default Parameters", validate_default_parameters),
        ("LoRA Nodes Disabled", validate_lora_nodes_disabled),
        ("Workflow Metadata", validate_metadata)
    ]
    
    for check_name, check_func in checks:
        passed, errors = check_func(workflow)
        
        if passed:
            print(f"✅ {check_name}: PASSED")
        else:
            print(f"❌ {check_name}: FAILED")
            for error in errors:
                print(f"   - {error}")
            all_passed = False
        print()
    
    # Summary
    print("=" * 60)
    if all_passed:
        print("✅ All validation checks passed!")
        print("\nWorkflow is ready for testing in ComfyUI.")
        print("\nNext steps:")
        print("1. Install required custom nodes")
        print("2. Download required models")
        print("3. Load workflow in ComfyUI")
        print("4. Test with sample images")
        sys.exit(0)
    else:
        print("❌ Some validation checks failed.")
        print("\nPlease fix the errors above before proceeding.")
        sys.exit(1)


if __name__ == '__main__':
    main()
