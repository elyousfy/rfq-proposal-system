"""
Generation control system for pause/stop/continue functionality.
Allows frontend to control proposal generation in real-time.
"""

from enum import Enum
from typing import Optional, Dict
from datetime import datetime
import threading

class GenerationStatus(Enum):
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    COMPLETED = "completed"
    ERROR = "error"

class GenerationController:
    """Thread-safe controller for managing proposal generation state."""

    def __init__(self):
        self._lock = threading.Lock()
        self._sessions: Dict[str, Dict] = {}

    def create_session(self, session_id: str) -> None:
        """Create a new generation session."""
        with self._lock:
            self._sessions[session_id] = {
                'status': GenerationStatus.RUNNING,
                'current_section': '',
                'total_sections': 0,
                'completed_sections': 0,
                'started_at': datetime.now().isoformat(),
                'message': ''
            }

    def get_status(self, session_id: str) -> Optional[Dict]:
        """Get current status of a generation session."""
        with self._lock:
            return self._sessions.get(session_id)

    def set_status(self, session_id: str, status: GenerationStatus, message: str = '') -> None:
        """Update session status."""
        with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id]['status'] = status
                self._sessions[session_id]['message'] = message

    def pause(self, session_id: str) -> bool:
        """Pause generation."""
        with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id]['status'] = GenerationStatus.PAUSED
                return True
            return False

    def resume(self, session_id: str) -> bool:
        """Resume paused generation."""
        with self._lock:
            if session_id in self._sessions and self._sessions[session_id]['status'] == GenerationStatus.PAUSED:
                self._sessions[session_id]['status'] = GenerationStatus.RUNNING
                return True
            return False

    def stop(self, session_id: str) -> bool:
        """Stop generation completely."""
        with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id]['status'] = GenerationStatus.STOPPED
                return True
            return False

    def update_progress(self, session_id: str, current_section: str, completed: int, total: int) -> None:
        """Update generation progress."""
        with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id]['current_section'] = current_section
                self._sessions[session_id]['completed_sections'] = completed
                self._sessions[session_id]['total_sections'] = total

    def should_continue(self, session_id: str) -> bool:
        """Check if generation should continue (not paused or stopped)."""
        with self._lock:
            if session_id not in self._sessions:
                return False
            status = self._sessions[session_id]['status']
            return status == GenerationStatus.RUNNING

    def wait_if_paused(self, session_id: str, check_interval: float = 0.5) -> bool:
        """
        Wait while paused. Returns False if stopped, True if should continue.
        """
        import time
        while True:
            with self._lock:
                if session_id not in self._sessions:
                    return False
                status = self._sessions[session_id]['status']

                if status == GenerationStatus.STOPPED:
                    return False
                elif status == GenerationStatus.RUNNING:
                    return True
                # If paused, continue loop

            time.sleep(check_interval)

    def cleanup_session(self, session_id: str) -> None:
        """Remove session data."""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]

# Global controller instance
controller = GenerationController()
