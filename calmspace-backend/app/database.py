from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Text, JSON, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime, os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./calmsense.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)

    # Section 1 — Basic Profile
    name = Column(String)
    age = Column(Integer)
    gender = Column(String)
    daily_role = Column(String)
    income_level = Column(String)

    # Section 2 — Stress Behavior Profile
    stress_behaviors = Column(Text)          # JSON list
    phone_more_when_stressed = Column(String)
    stress_apps = Column(Text)               # JSON list

    # Section 3 — Wellness & Coping Profile
    relaxers = Column(Text)                  # JSON list
    reminder_type = Column(Text)             # JSON list
    ui_style = Column(String)

    # Section 4 — Optional Research
    typical_stress_level = Column(Float)
    sleep_quality = Column(String)
    activity_frequency = Column(String)

    # Derived — Digital Coping Style Classification
    coping_style = Column(String)            # e.g. "social_escaper"
    coping_style_label = Column(String)
    coping_confidence = Column(Integer)
    coping_scores_json = Column(Text)        # JSON dict of raw scores

    # Personalization state
    local_threshold = Column(Float, default=5.5)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Continuous stress EMA baseline (15-min bucket cadence)
    ema_stress = Column(Float, default=0.0)
    ema_variance = Column(Float, default=0.0)
    ema_count = Column(Integer, default=0)

    # Cooldown for the behavior-change EMA prompt (see decision_engine.py) —
    # separate from the stress EMA above, which is a different concept (a
    # running average) that happens to share the acronym.
    last_ema_prompt_at = Column(DateTime, nullable=True)


class TelemetrySnapshot(Base):
    __tablename__ = "telemetry_snapshots"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    device_hours_per_day = Column(Float)
    phone_unlocks = Column(Integer)
    notifications_per_day = Column(Integer)
    social_media_mins = Column(Integer)
    sleep_hours = Column(Float)
    sleep_quality = Column(Float)
    focus_score = Column(Float)
    study_or_work_mins = Column(Integer)
    predicted_stress = Column(Float)
    ema_stress = Column(Float)
    deviation = Column(Float)
    is_anomaly = Column(Integer, default=0)  # 0/1, SQLite has no bool
    captured_at = Column(DateTime, default=datetime.datetime.utcnow)


class InteractionEvent(Base):
    __tablename__ = "interaction_events"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    event_type = Column(String)       # success_event | rejection_event
    action = Column(String)
    metadata_json = Column(Text)
    stress_at_event = Column(Float)
    coping_style = Column(String)     # archetype active at time of event — for research analysis
    logged_at = Column(DateTime, default=datetime.datetime.utcnow)


class BehaviorObservation(Base):
    """One synced 15-min on-device aggregation window (see calmspace-app/src/lib/db/aggregationService.js).
    Raw events never leave the device — only these aggregates."""
    __tablename__ = "behavior_observations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    window_start = Column(DateTime, index=True)
    window_end = Column(DateTime)
    screen_time_sec = Column(Integer)
    unlock_count = Column(Integer)
    notification_count = Column(Integer)
    social_media_sec = Column(Integer)
    session_count = Column(Integer)
    avg_session_sec = Column(Float)
    night_usage_flag = Column(Integer, default=0)
    synced_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Without this, a race between the real-time /behavior/analyze call and the
    # periodic batch /behavior/sync call can both pass their own "does this row
    # exist" check before either commits, inserting the same window twice —
    # which double-counts it in /telemetry sums and confuses the deviation engine.
    __table_args__ = (UniqueConstraint('user_id', 'window_start', name='uq_observation_user_window'),)


class EmaLabel(Base):
    """User-reported stress level captured on-device when the behavior decision
    engine detects a persistent, multi-feature deviation. The labeled dataset
    for later Python model training (see Phase 9/13 of the CalmSense research plan)."""
    __tablename__ = "ema_labels"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    window_start = Column(DateTime, index=True)
    stress_level = Column(Integer)
    mood = Column(String)
    deviated_count = Column(Integer)
    details_json = Column(Text)
    responded_at = Column(DateTime)
    synced_at = Column(DateTime, default=datetime.datetime.utcnow)


class BehaviorDeviation(Base):
    """Persisted result of deviation_engine.compute_deviation() for one window —
    lets temporal_engine.is_persistent_change() look back across windows without
    recomputing history queries each time."""
    __tablename__ = "behavior_deviations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, index=True)
    window_start = Column(DateTime, index=True)
    deviated_count = Column(Integer)
    details_json = Column(Text)

    __table_args__ = (UniqueConstraint('user_id', 'window_start', name='uq_deviation_user_window'),)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
