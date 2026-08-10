from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
import json, datetime

from .database import (
    create_tables, get_db, User, TelemetrySnapshot, InteractionEvent,
    BehaviorObservation, EmaLabel, BehaviorDeviation,
)
from .decision_engine import evaluate_window
from .time_series_context_builder import build_context
from .model import predict_stress, predict_stress_mock, FEATURE_ORDER
from .stress_tracker import update_ema

app = FastAPI(title="CalmSense API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    features: dict
    user_id: Optional[int] = None


class EventRequest(BaseModel):
    type: str
    metadata: dict = {}
    ts: Optional[int] = None
    user_id: Optional[int] = None
    stress_at_event: Optional[float] = None
    coping_style: Optional[str] = None


class BehaviorObservationIn(BaseModel):
    window_start: int  # epoch ms, matches the on-device SQLite column
    window_end: int
    screen_time_sec: int
    unlock_count: int
    notification_count: int
    social_media_sec: int
    session_count: int
    avg_session_sec: float
    night_usage_flag: int = 0


class BehaviorSyncRequest(BaseModel):
    user_id: Optional[int] = None
    observations: List[BehaviorObservationIn]


class BehaviorAnalyzeRequest(BaseModel):
    user_id: Optional[int] = None
    observation: BehaviorObservationIn


class EmaLabelIn(BaseModel):
    window_start: int
    stress_level: int
    mood: Optional[str] = None
    deviated_count: Optional[int] = None
    details: Optional[dict] = None
    responded_at: int
    user_id: Optional[int] = None


class UserCreate(BaseModel):
    # Section 1 — Basic Profile
    name: str
    age: int
    gender: str
    daily_role: str
    income_level: Optional[str] = None

    # Section 2 — Stress Behavior
    stress_behaviors: Optional[List[str]] = []
    phone_more_when_stressed: Optional[str] = None
    stress_apps: Optional[List[str]] = []

    # Section 3 — Wellness & Coping
    relaxers: Optional[List[str]] = []
    reminder_type: Optional[List[str]] = []
    ui_style: Optional[str] = None

    # Section 4 — Optional Research
    typical_stress_level: Optional[float] = None
    sleep_quality: Optional[str] = None
    activity_frequency: Optional[str] = None

    # Derived — Coping Classification
    coping_style: Optional[str] = None
    coping_style_label: Optional[str] = None
    coping_confidence: Optional[int] = None
    coping_scores: Optional[dict] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/predict")
def predict(req: PredictRequest, db: Session = Depends(get_db)):
    try:
        stress_level = predict_stress(req.features)
        offline = False
    except FileNotFoundError:
        stress_level = predict_stress_mock(req.features)
        offline = True

    ema_state = None
    if req.user_id:
        user = db.query(User).filter(User.id == req.user_id).first()
        if user:
            ema_state = update_ema(user.ema_stress or 0.0, user.ema_variance or 0.0, user.ema_count or 0, stress_level)
            user.ema_stress = ema_state["ema"]
            user.ema_variance = ema_state["variance"]
            user.ema_count = ema_state["count"]

        snap = TelemetrySnapshot(
            user_id=req.user_id,
            predicted_stress=stress_level,
            ema_stress=ema_state["ema"] if ema_state else None,
            deviation=ema_state["deviation"] if ema_state else None,
            is_anomaly=int(ema_state["is_anomaly"]) if ema_state else 0,
            **{k: req.features.get(k) for k in FEATURE_ORDER},
        )
        db.add(snap)
        db.commit()

    band = "low" if stress_level <= 3 else "moderate" if stress_level <= 6 else "high"
    result = {"stress_level": stress_level, "band": band, "offline": offline}
    if ema_state:
        result["ema"] = ema_state["ema"]
        result["deviation"] = ema_state["deviation"]
        result["is_anomaly"] = ema_state["is_anomaly"]
        result["warmed_up"] = ema_state["warmed_up"]
    return result


@app.post("/events")
def log_event(req: EventRequest, db: Session = Depends(get_db)):
    event = InteractionEvent(
        user_id=req.user_id,
        event_type=req.type,
        action=req.metadata.get("action") or req.metadata.get("reason", ""),
        metadata_json=json.dumps(req.metadata),
        stress_at_event=req.stress_at_event,
        coping_style=req.coping_style,
    )
    db.add(event)
    db.commit()
    return {"status": "logged"}


@app.post("/behavior/sync")
def sync_behavior_observations(req: BehaviorSyncRequest, db: Session = Depends(get_db)):
    """Receives on-device-aggregated 15-min windows only — never raw events.
    Dedupes on (user_id, window_start) so repeated sync ticks are safe."""
    inserted = 0
    for o in req.observations:
        window_start_dt = datetime.datetime.utcfromtimestamp(o.window_start / 1000)
        exists = db.query(BehaviorObservation).filter(
            BehaviorObservation.user_id == req.user_id,
            BehaviorObservation.window_start == window_start_dt,
        ).first()
        if exists:
            continue
        db.add(BehaviorObservation(
            user_id=req.user_id,
            window_start=window_start_dt,
            window_end=datetime.datetime.utcfromtimestamp(o.window_end / 1000),
            screen_time_sec=o.screen_time_sec,
            unlock_count=o.unlock_count,
            notification_count=o.notification_count,
            social_media_sec=o.social_media_sec,
            session_count=o.session_count,
            avg_session_sec=o.avg_session_sec,
            night_usage_flag=o.night_usage_flag,
        ))
        try:
            db.commit()
            inserted += 1
        except IntegrityError:
            # Lost a race against /behavior/analyze inserting the same window
            # concurrently — the unique constraint on (user_id, window_start)
            # caught it, which is exactly what it's there for.
            db.rollback()
    return {"inserted": inserted, "received": len(req.observations)}


@app.post("/behavior/analyze")
def analyze_behavior_window(req: BehaviorAnalyzeRequest, db: Session = Depends(get_db)):
    """Runs the Python median/MAD/robust-z-score deviation engine (statistical_engine.py
    + baseline_engine.py + deviation_engine.py) plus the temporal persistence check
    (temporal_engine.py) and the EMA-trigger decision (decision_engine.py) against
    this user's real history in the database. Called immediately after each on-device
    15-min aggregation window, not batched — the app needs the trigger decision in
    near-real-time to show the EMA prompt while it's still relevant."""
    window_start_dt = datetime.datetime.utcfromtimestamp(req.observation.window_start / 1000)
    row = db.query(BehaviorObservation).filter(
        BehaviorObservation.user_id == req.user_id,
        BehaviorObservation.window_start == window_start_dt,
    ).first()
    if not row:
        row = BehaviorObservation(
            user_id=req.user_id,
            window_start=window_start_dt,
            window_end=datetime.datetime.utcfromtimestamp(req.observation.window_end / 1000),
            screen_time_sec=req.observation.screen_time_sec,
            unlock_count=req.observation.unlock_count,
            notification_count=req.observation.notification_count,
            social_media_sec=req.observation.social_media_sec,
            session_count=req.observation.session_count,
            avg_session_sec=req.observation.avg_session_sec,
            night_usage_flag=req.observation.night_usage_flag,
        )
        db.add(row)
        try:
            db.commit()
            db.refresh(row)
        except IntegrityError:
            # Lost a race against /behavior/sync inserting the same window
            # concurrently — fetch the row it just created instead.
            db.rollback()
            row = db.query(BehaviorObservation).filter(
                BehaviorObservation.user_id == req.user_id,
                BehaviorObservation.window_start == window_start_dt,
            ).first()

    result = evaluate_window(db, row)
    return {
        "trigger": result["trigger"],
        "reason": result["reason"],
        "deviated_count": result["deviation"]["deviated_count"],
        "per_feature": result["deviation"]["per_feature"],
    }


@app.post("/behavior/ema")
def submit_ema_label(req: EmaLabelIn, db: Session = Depends(get_db)):
    """Stores a user-reported stress label triggered by the decision engine —
    this becomes the training dataset for the eventual stress model. Also stamps
    the cooldown so /behavior/analyze doesn't trigger again for 2 hours."""
    row = EmaLabel(
        user_id=req.user_id,
        window_start=datetime.datetime.utcfromtimestamp(req.window_start / 1000),
        stress_level=req.stress_level,
        mood=req.mood,
        deviated_count=req.deviated_count,
        details_json=json.dumps(req.details or {}),
        responded_at=datetime.datetime.utcfromtimestamp(req.responded_at / 1000),
    )
    db.add(row)

    if req.user_id:
        user = db.query(User).filter(User.id == req.user_id).first()
        if user:
            user.last_ema_prompt_at = datetime.datetime.utcnow()

    db.commit()
    return {"status": "logged", "id": row.id}


@app.get("/behavior/history")
def behavior_history(user_id: int, limit: int = 12, db: Session = Depends(get_db)):
    """Real recent 15-min windows plus whatever deviation_engine already computed
    for each one — powers the transparency/analysis page, no synthetic data."""
    observations = (
        db.query(BehaviorObservation)
        .filter(BehaviorObservation.user_id == user_id)
        .order_by(BehaviorObservation.window_start.desc())
        .limit(limit)
        .all()
    )
    deviations = {
        d.window_start: d
        for d in db.query(BehaviorDeviation).filter(BehaviorDeviation.user_id == user_id).all()
    }
    return [
        {
            "window_start": int(o.window_start.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000),
            "window_end": int(o.window_end.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000),
            "screen_time_sec": o.screen_time_sec,
            "unlock_count": o.unlock_count,
            "notification_count": o.notification_count,
            "social_media_sec": o.social_media_sec,
            "deviated_count": deviations[o.window_start].deviated_count if o.window_start in deviations else None,
        }
        for o in observations
    ]


@app.get("/behavior/context")
def behavior_context(user_id: int, window_start: int | None = None, db: Session = Depends(get_db)):
    """TimeSeriesContextBuilder — the full Phase-4 historical context (recent
    intervals, previous-day same time, same-slot last 14 days, same-weekday
    same-time, today-so-far) for one window. Defaults to the most recent
    window if none is given, so the app can show "what backs the latest
    analysis" without knowing a specific timestamp."""
    if window_start is not None:
        target = datetime.datetime.utcfromtimestamp(window_start / 1000)
    else:
        latest = (
            db.query(BehaviorObservation)
            .filter(BehaviorObservation.user_id == user_id)
            .order_by(BehaviorObservation.window_start.desc())
            .first()
        )
        if not latest:
            return {"window_start": None, "recent_intervals": [], "previous_day_same_time": None,
                    "same_slot_last_14_days": [], "same_weekday_same_time": [], "today_so_far": []}
        target = latest.window_start

    return build_context(db, user_id, target)


@app.get("/behavior/daily-summary")
def behavior_daily_summary(user_id: int, days: int = 7, db: Session = Depends(get_db)):
    """Real per-day totals over the last N days — the week trend chart on the
    analysis page reads from here instead of a hardcoded stress curve."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    rows = (
        db.query(BehaviorObservation)
        .filter(BehaviorObservation.user_id == user_id, BehaviorObservation.window_start >= cutoff)
        .all()
    )
    by_day = {}
    for r in rows:
        day_key = r.window_start.strftime("%Y-%m-%d")
        bucket = by_day.setdefault(day_key, {"screen_time_sec": 0, "unlock_count": 0, "notification_count": 0})
        bucket["screen_time_sec"] += r.screen_time_sec
        bucket["unlock_count"] += r.unlock_count
        bucket["notification_count"] += r.notification_count
    return [{"date": day, **totals} for day, totals in sorted(by_day.items())]


@app.get("/behavior/stats")
def behavior_stats(user_id: int, db: Session = Depends(get_db)):
    """Real days-active / total-windows / streak — replaces the hardcoded
    '12 Days Active · 8 Sessions Done · 5 Day Streak' stat row."""
    rows = (
        db.query(BehaviorObservation.window_start)
        .filter(BehaviorObservation.user_id == user_id)
        .order_by(BehaviorObservation.window_start)
        .all()
    )
    days = sorted({r.window_start.date() for r in rows})
    streak = 0
    if days:
        streak = 1
        cursor = days[-1]
        for d in reversed(days[:-1]):
            if (cursor - d).days == 1:
                streak += 1
                cursor = d
            else:
                break
    successes = (
        db.query(InteractionEvent)
        .filter(InteractionEvent.user_id == user_id, InteractionEvent.event_type == "success_event")
        .count()
    )
    return {
        "days_active": len(days),
        "total_windows": len(rows),
        "sessions_done": successes,
        "streak_days": streak,
    }


MOCK_TELEMETRY = {
    "device_hours_per_day": 6.7,
    "phone_unlocks": 143,
    "notifications_per_day": 88,
    "social_media_mins": 74,
    "sleep_hours": 6.5,
    "sleep_quality": 62.0,
    "focus_score": 44.0,
    "study_or_work_mins": 210,
}


@app.get("/telemetry")
def get_telemetry(user_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Real screen-time/unlocks/notifications/social-media come from today's synced
    behavior_observations. sleep/focus/study aren't captured by the passive-behavior
    pipeline (no sleep sensor, no focus/study-app classifier), so they stay null
    rather than fabricated — the UI shows '—' for those instead of a fake number."""
    if user_id:
        # Once a user is registered, telemetry is always real — even if that means
        # all zeros right after onboarding, before the first 15-min window completes.
        # Falling back to MOCK_TELEMETRY here would silently show fabricated numbers
        # on a genuinely fresh account, which is the exact bug this endpoint existed
        # to fix in the first place.
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        rows = db.query(BehaviorObservation).filter(
            BehaviorObservation.user_id == user_id,
            BehaviorObservation.window_start >= today_start,
        ).all()
        screen_time_sec = sum(r.screen_time_sec for r in rows)
        social_media_sec = sum(r.social_media_sec for r in rows)
        return {
            "device_hours_per_day": round(screen_time_sec / 3600, 2),
            "phone_unlocks": sum(r.unlock_count for r in rows),
            "notifications_per_day": sum(r.notification_count for r in rows),
            "social_media_mins": round(social_media_sec / 60),
            "sleep_hours": None,
            "sleep_quality": None,
            "focus_score": None,
            "study_or_work_mins": None,
            "source": "real",
        }
    return {**MOCK_TELEMETRY, "source": "mock"}


@app.get("/user/profile")
def get_profile(user_id: Optional[int] = None, db: Session = Depends(get_db)):
    # Falling back to "first user in the table" when no user_id is given was
    # only ever correct for a single-user dev database — with multiple test
    # accounts it silently returns whichever profile happens to be oldest.
    user = db.query(User).filter(User.id == user_id).first() if user_id else db.query(User).first()
    if not user:
        return {"name": "User", "age": 0, "gender": "", "daily_role": "", "local_threshold": 5.5}
    return {
        "name": user.name,
        "age": user.age,
        "gender": user.gender,
        "daily_role": user.daily_role,
        "income_level": user.income_level,
        "coping_style": user.coping_style,
        "coping_style_label": user.coping_style_label,
        "coping_confidence": user.coping_confidence,
        "ui_style": user.ui_style,
        "reminder_type": json.loads(user.reminder_type or "[]"),
        "local_threshold": user.local_threshold,
    }


@app.post("/user/register")
def register_user(body: UserCreate, db: Session = Depends(get_db)):
    user = User(
        name=body.name,
        age=body.age,
        gender=body.gender,
        daily_role=body.daily_role,
        income_level=body.income_level,
        stress_behaviors=json.dumps(body.stress_behaviors or []),
        phone_more_when_stressed=body.phone_more_when_stressed,
        stress_apps=json.dumps(body.stress_apps or []),
        relaxers=json.dumps(body.relaxers or []),
        reminder_type=json.dumps(body.reminder_type or []),
        ui_style=body.ui_style,
        typical_stress_level=body.typical_stress_level,
        sleep_quality=body.sleep_quality,
        activity_frequency=body.activity_frequency,
        coping_style=body.coping_style,
        coping_style_label=body.coping_style_label,
        coping_confidence=body.coping_confidence,
        coping_scores_json=json.dumps(body.coping_scores or {}),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "message": "Profile created", "coping_style": user.coping_style}


@app.get("/insights/weekly")
def weekly_insights(db: Session = Depends(get_db)):
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    snaps = db.query(TelemetrySnapshot).filter(TelemetrySnapshot.captured_at >= cutoff).all()
    return [
        {"day": s.captured_at.strftime("%a"), "stress": s.predicted_stress, "unlocks": s.phone_unlocks}
        for s in snaps
    ]


@app.get("/insights/events")
def event_log(user_id: Optional[int] = None, limit: int = 20, db: Session = Depends(get_db)):
    query = db.query(InteractionEvent)
    if user_id:
        query = query.filter(InteractionEvent.user_id == user_id)
    events = query.order_by(InteractionEvent.logged_at.desc()).limit(limit).all()
    return [
        {"type": e.event_type, "action": e.action, "coping_style": e.coping_style, "time": e.logged_at.isoformat()}
        for e in events
    ]


@app.get("/research/coping-distribution")
def coping_distribution(db: Session = Depends(get_db)):
    """Research endpoint: distribution of coping styles across all users."""
    users = db.query(User.coping_style).all()
    dist = {}
    for (style,) in users:
        if style:
            dist[style] = dist.get(style, 0) + 1
    return dist


@app.get("/research/intervention-effectiveness")
def intervention_effectiveness(db: Session = Depends(get_db)):
    """Research endpoint: success vs rejection rate per coping style."""
    events = db.query(InteractionEvent).all()
    result = {}
    for e in events:
        key = e.coping_style or "unknown"
        if key not in result:
            result[key] = {"success": 0, "rejection": 0}
        if e.event_type == "success_event":
            result[key]["success"] += 1
        elif e.event_type == "rejection_event":
            result[key]["rejection"] += 1
    for k in result:
        total = result[k]["success"] + result[k]["rejection"]
        result[k]["acceptance_rate"] = round(result[k]["success"] / total * 100, 1) if total else 0
    return result


@app.post("/optimize/threshold")
def optimize_threshold(user_id: int, db: Session = Depends(get_db)):
    """Nightly optimizer: shifts local_threshold based on daily rejection/success ratio."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    rejections = db.query(InteractionEvent).filter(
        InteractionEvent.user_id == user_id,
        InteractionEvent.event_type == "rejection_event",
        InteractionEvent.logged_at >= cutoff,
    ).count()
    successes = db.query(InteractionEvent).filter(
        InteractionEvent.user_id == user_id,
        InteractionEvent.event_type == "success_event",
        InteractionEvent.logged_at >= cutoff,
    ).count()

    delta = (rejections - successes) * 0.1
    user.local_threshold = round(max(3.0, min(9.0, user.local_threshold + delta)), 2)
    db.commit()

    return {"new_threshold": user.local_threshold, "rejections": rejections, "successes": successes}


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0"}
