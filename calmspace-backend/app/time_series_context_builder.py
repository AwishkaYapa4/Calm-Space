"""Builds the full historical context for one window (Phase 4 of the research
plan): recent intervals, previous-day same time, same time-slot across the
last 14 days, same weekday across recent weeks, and today-so-far. Where
deviation_engine.py only needs a single baseline array to compute a z-score,
this module exists so the *reasoning* behind an analysis is inspectable —
surfaced on the app's Data & Analysis page rather than just trusted blindly."""
import datetime
from sqlalchemy.orm import Session

from .database import BehaviorObservation

FEATURES = ["screen_time_sec", "unlock_count", "notification_count", "social_media_sec"]


def _serialize(obs):
    return {
        "window_start": obs.window_start.isoformat(),
        **{f: getattr(obs, f) for f in FEATURES},
    }


def _query_range(db: Session, user_id, lower: datetime.datetime, upper: datetime.datetime):
    return (
        db.query(BehaviorObservation)
        .filter(
            BehaviorObservation.user_id == user_id,
            BehaviorObservation.window_start >= lower,
            BehaviorObservation.window_start < upper,
        )
        .order_by(BehaviorObservation.window_start)
        .all()
    )


def build_context(db: Session, user_id, window_start: datetime.datetime, lookback_days: int = 14):
    # 1. Last 4 intervals — the last hour, any time slot.
    recent = (
        db.query(BehaviorObservation)
        .filter(BehaviorObservation.user_id == user_id, BehaviorObservation.window_start < window_start)
        .order_by(BehaviorObservation.window_start.desc())
        .limit(4)
        .all()
    )

    # 2. Previous day, same time slot exactly.
    prev_day_start = window_start - datetime.timedelta(days=1)
    previous_day_same_time = (
        db.query(BehaviorObservation)
        .filter(
            BehaviorObservation.user_id == user_id,
            BehaviorObservation.window_start == prev_day_start,
        )
        .first()
    )

    # 3. Same 15-min slot across the last N days (the deviation-engine baseline).
    lower_14 = window_start - datetime.timedelta(days=lookback_days)
    same_slot_all = _query_range(db, user_id, lower_14, window_start)
    same_slot_last_n_days = [
        o for o in same_slot_all if o.window_start.hour == window_start.hour and o.window_start.minute == window_start.minute
    ]

    # 4. Same weekday, same time slot, across recent weeks (subset of #3, weekday-filtered).
    same_weekday_same_time = [o for o in same_slot_last_n_days if o.window_start.weekday() == window_start.weekday()]

    # 5. Today's observations so far (local calendar day of window_start).
    today_start = window_start.replace(hour=0, minute=0, second=0, microsecond=0)
    today_so_far = _query_range(db, user_id, today_start, window_start)

    return {
        "window_start": window_start.isoformat(),
        "recent_intervals": [_serialize(o) for o in reversed(recent)],
        "previous_day_same_time": _serialize(previous_day_same_time) if previous_day_same_time else None,
        "same_slot_last_14_days": [_serialize(o) for o in same_slot_last_n_days],
        "same_weekday_same_time": [_serialize(o) for o in same_weekday_same_time],
        "today_so_far": [_serialize(o) for o in today_so_far],
    }
