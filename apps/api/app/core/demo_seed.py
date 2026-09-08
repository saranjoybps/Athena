"""Demo seeding is disabled. Kept only so imports do not break.

Demo data previously came from in-memory store + ATHENA_AUTH=dev auto-seed.
Use Firestore + Firebase Auth; create orgs via /onboarding.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def ensure_demo_account() -> None:
    """No-op: never seed demo accounts or sample data."""
    logger.debug("Demo auto-seed is disabled")
