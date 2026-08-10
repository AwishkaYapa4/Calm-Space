"""Distinguishes a single spike from a sustained behavioral change (Phase 7/8)."""
from sqlalchemy.orm import Session

from .database import BehaviorDeviation

MULTI_FEATURE_THRESHOLD = 2  # a window only "counts" as abnormal if 2+ features deviated


def is_persistent_change(db: Session, user_id, window_start, min_abnormal_of: int = 3, lookback: int = 4) -> bool:
    rows = (
        db.query(BehaviorDeviation)
        .filter(
            BehaviorDeviation.user_id == user_id,
            BehaviorDeviation.window_start <= window_start,
        )
        .order_by(BehaviorDeviation.window_start.desc())
        .limit(lookback)
        .all()
    )
    abnormal_count = sum(1 for r in rows if r.deviated_count >= MULTI_FEATURE_THRESHOLD)
    return abnormal_count >= min_abnormal_of
