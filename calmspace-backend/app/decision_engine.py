"""Runs after every new observation window: persists the deviation result,
then decides whether it's worth interrupting the user with an EMA prompt.
Mirrors Phase 8's rule: >=2 deviated features AND persistent in 3 of the
last 4 windows AND the cooldown has elapsed."""
import datetime
import json
from sqlalchemy.orm import Session

from .database import BehaviorDeviation, User, sl_now
from .deviation_engine import compute_deviation
from .temporal_engine import is_persistent_change

MIN_DEVIATED_FEATURES = 2
COOLDOWN = datetime.timedelta(hours=2)


def evaluate_window(db: Session, observation):
    deviation = compute_deviation(db, observation)

    existing = (
        db.query(BehaviorDeviation)
        .filter_by(user_id=observation.user_id, window_start=observation.window_start)
        .first()
    )
    if existing:
        existing.deviated_count = deviation["deviated_count"]
        existing.details_json = json.dumps(deviation["per_feature"])
    else:
        db.add(BehaviorDeviation(
            user_id=observation.user_id,
            window_start=observation.window_start,
            deviated_count=deviation["deviated_count"],
            details_json=json.dumps(deviation["per_feature"]),
        ))
    db.commit()

    if deviation["deviated_count"] < MIN_DEVIATED_FEATURES:
        return {"trigger": False, "reason": "insufficient_features", "deviation": deviation}

    if not is_persistent_change(db, observation.user_id, observation.window_start):
        return {"trigger": False, "reason": "not_persistent", "deviation": deviation}

    user = db.query(User).filter(User.id == observation.user_id).first() if observation.user_id else None
    if user and user.last_ema_prompt_at and (sl_now() - user.last_ema_prompt_at) < COOLDOWN:
        return {"trigger": False, "reason": "cooldown", "deviation": deviation}

    return {"trigger": True, "reason": None, "deviation": deviation}
