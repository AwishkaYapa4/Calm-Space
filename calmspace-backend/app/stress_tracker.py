import math

BUCKET_MINUTES = 15
HALF_LIFE_MINUTES = 120  # how fast the baseline forgets old readings
ALPHA = 1 - 0.5 ** (BUCKET_MINUTES / HALF_LIFE_MINUTES)  # ~0.094
DEVIATION_K = 2.0        # flag when |value - EMA| exceeds k * adaptive std
WARMUP_BUCKETS = 8       # ~2 hours before deviation flags are trusted


def update_ema(prev_ema, prev_variance, count, value):
    """Advance a user's EWMA baseline and EWMA-of-squared-deviation (adaptive std)
    by one 15-min bucket, returning the new state plus a deviation verdict."""
    if count == 0:
        ema = value
        variance = 0.0
    else:
        deviation = value - prev_ema
        ema = prev_ema + ALPHA * deviation
        variance = (1 - ALPHA) * (prev_variance + ALPHA * deviation ** 2)

    count += 1
    std = math.sqrt(variance)
    deviation_from_ema = value - ema
    warmed_up = count > WARMUP_BUCKETS
    is_anomaly = warmed_up and std > 0 and abs(deviation_from_ema) > DEVIATION_K * std

    return {
        "ema": round(ema, 3),
        "variance": variance,
        "count": count,
        "std": round(std, 3),
        "deviation": round(deviation_from_ema, 3),
        "is_anomaly": is_anomaly,
        "warmed_up": warmed_up,
    }
