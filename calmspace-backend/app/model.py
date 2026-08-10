import joblib, numpy as np, os

MODEL_PATH = os.getenv("MODEL_PATH", "assets/calmsense_baseline_model.pkl")
SCALER_PATH = os.getenv("SCALER_PATH", "assets/calmsense_scaler.pkl")

_model = None
_scaler = None

FEATURE_ORDER = [
    "device_hours_per_day",
    "phone_unlocks",
    "notifications_per_day",
    "social_media_mins",
    "sleep_hours",
    "sleep_quality",
    "focus_score",
    "study_or_work_mins",
]


def _load():
    global _model, _scaler
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Export from Colab first.")
        _model = joblib.load(MODEL_PATH)
        _scaler = joblib.load(SCALER_PATH)


def predict_stress(features: dict) -> float:
    """Accept a dict of feature values and return predicted stress_level (1–10)."""
    _load()
    # Real (non-mock) telemetry can have null sleep/focus/study fields — the passive-
    # behavior pipeline doesn't capture those — so treat present-but-null the same as missing.
    vector = np.array([[features.get(f) if features.get(f) is not None else 0.0 for f in FEATURE_ORDER]])
    scaled = _scaler.transform(vector)
    raw = float(_model.predict(scaled)[0])
    return round(max(1.0, min(10.0, raw)), 2)


def predict_stress_mock(features: dict) -> float:
    """Offline heuristic fallback when .pkl files are missing."""
    raw = (
        features.get("phone_unlocks", 100) / 374 * 10
        + features.get("device_hours_per_day", 6) / 17.16 * 10
        + features.get("notifications_per_day", 80) / 250 * 10
    ) / 3
    return round(max(1.0, min(10.0, raw)), 2)
