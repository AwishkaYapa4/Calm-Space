"""Compares one completed observation window against a personal baseline,
feature by feature (Phase 5/6). Doesn't decide anything on its own —
decision_engine.py combines this with the temporal persistence check."""
from sqlalchemy.orm import Session

from .statistical_engine import robust_z_score
from .baseline_engine import get_same_slot_history, get_recent_history

FEATURES = ["screen_time_sec", "unlock_count", "notification_count", "social_media_sec"]
Z_THRESHOLD = 2.5
MIN_HISTORY_POINTS = 3  # fewer than this and we can't judge "normal" yet
RECENT_FALLBACK_COUNT = 20  # windows to pull when same-slot history is too sparse


def compute_deviation(db: Session, observation):
    same_slot = get_same_slot_history(db, observation.user_id, observation.window_start)
    per_feature = {}
    deviated_count = 0

    # The same-time-slot baseline (Phase 5) is the most personally accurate, but
    # needs weeks of history to have 3+ points at any given 15-min slot. Early on
    # (first ~2 weeks of a real account), fall back to the last N windows regardless
    # of time-of-day — still real behavior, just a coarser "recent normal" baseline
    # instead of "normal for this exact time." baseline_source in the response makes
    # it visible which one was actually used.
    baseline_source = "same_slot"
    history = same_slot
    if len(history) < MIN_HISTORY_POINTS:
        recent = get_recent_history(db, observation.user_id, observation.window_start, RECENT_FALLBACK_COUNT)
        if len(recent) >= MIN_HISTORY_POINTS:
            history = recent
            baseline_source = "recent_fallback"

    for feature in FEATURES:
        history_values = [getattr(h, feature) for h in history]
        current_value = getattr(observation, feature)
        z_score = robust_z_score(current_value, history_values)
        is_anomalous = len(history_values) >= MIN_HISTORY_POINTS and abs(z_score) >= Z_THRESHOLD
        per_feature[feature] = {
            "value": current_value,
            "z_score": round(z_score, 2),
            "is_anomalous": is_anomalous,
            "history_count": len(history_values),
        }
        if is_anomalous:
            deviated_count += 1

    return {"deviated_count": deviated_count, "per_feature": per_feature, "baseline_source": baseline_source}
