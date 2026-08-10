"""Builds the personal historical context for one observation window
(Phase 4/5 of the CalmSense research architecture)."""
import datetime
from sqlalchemy.orm import Session

from .database import BehaviorObservation


def get_same_slot_history(db: Session, user_id, window_start: datetime.datetime, lookback_days: int = 14):
    """Same 15-min time-of-day slot on previous days — the personal baseline
    ("normal Friday 8 PM ≈ 5.5 min"). Storing window_start as a real DateTime
    (rather than epoch ms) makes this a plain hour/minute comparison in Python,
    no modulo-arithmetic tricks needed."""
    lower = window_start - datetime.timedelta(days=lookback_days)
    rows = (
        db.query(BehaviorObservation)
        .filter(
            BehaviorObservation.user_id == user_id,
            BehaviorObservation.window_start < window_start,
            BehaviorObservation.window_start >= lower,
        )
        .all()
    )
    return [r for r in rows if r.window_start.hour == window_start.hour and r.window_start.minute == window_start.minute]


def get_recent_history(db: Session, user_id, window_start: datetime.datetime, count: int = 4):
    """Last N completed windows regardless of time slot — used for the
    "single spike vs. sustained change" temporal persistence check."""
    return (
        db.query(BehaviorObservation)
        .filter(
            BehaviorObservation.user_id == user_id,
            BehaviorObservation.window_start < window_start,
        )
        .order_by(BehaviorObservation.window_start.desc())
        .limit(count)
        .all()
    )
