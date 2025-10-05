"""
Webhook Progress Tracker - Sends progress updates throughout workflow
"""

import requests
import time


class WebhookProgress:
    """
    Tracks and sends progress updates at each workflow stage
    Integrates with workflow execution to provide real-time feedback
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "webhook_url": ("STRING", {
                    "default": "",
                    "placeholder": "https://yourapp.com/api/headshots/webhook"
                }),
                "job_id": ("STRING", {
                    "default": "",
                    "placeholder": "job-uuid"
                }),
            },
            "optional": {
                "enabled": ("BOOLEAN", {
                    "default": True
                }),
            }
        }
    
    RETURN_TYPES = ()
    FUNCTION = "track_progress"
    CATEGORY = "utility"
    OUTPUT_NODE = True
    
    def track_progress(self, webhook_url, job_id, enabled=True):
        """
        Initialize progress tracking
        
        This node doesn't process data, it just sets up progress tracking
        Actual progress updates are sent by individual nodes
        """
        if enabled and webhook_url:
            print(f"Progress tracking enabled for job {job_id}")
            print(f"  Webhook URL: {webhook_url}")
        else:
            print("Progress tracking disabled")
        
        return ()


def send_progress_update(webhook_url, job_id, progress, message, metadata=None):
    """
    Send progress update to webhook
    
    Args:
        webhook_url: Webhook endpoint URL
        job_id: Job identifier
        progress: Progress percentage (0-100)
        message: Progress message
        metadata: Optional additional data
    
    Returns:
        Boolean indicating success
    """
    if not webhook_url or not job_id:
        return False
    
    payload = {
        "job_id": job_id,
        "status": "processing",
        "progress": progress,
        "message": message,
        "timestamp": time.time()
    }
    
    if metadata:
        payload["metadata"] = metadata
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Failed to send progress update: {str(e)}")
        return False


# Progress stage definitions (matches workflow.json config)
PROGRESS_STAGES = {
    "load_images": {
        "progress": 10,
        "message": "Loading reference images..."
    },
    "remove_background": {
        "progress": 20,
        "message": "Removing backgrounds..."
    },
    "analyze_features": {
        "progress": 40,
        "message": "Analyzing facial features..."
    },
    "generate_headshots": {
        "progress": 50,
        "message": "Generating professional headshots..."
    },
    "refine_style": {
        "progress": 80,
        "message": "Refining photography style..."
    },
    "complete": {
        "progress": 100,
        "message": "Complete!"
    }
}


def get_progress_stage(stage_name):
    """Get progress information for a stage"""
    return PROGRESS_STAGES.get(stage_name, {
        "progress": 0,
        "message": "Processing..."
    })
