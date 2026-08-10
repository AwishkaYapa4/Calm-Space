"""Median / MAD / robust z-score — deliberately not mean/stdev, since a single
heavy-usage day shouldn't blow out the baseline the way an outlier-sensitive
mean would (Phase 6 of the CalmSense research architecture)."""
import statistics

MAD_SCALE = 0.6745  # normal-consistency constant


def median(values):
    if not values:
        return 0.0
    return statistics.median(values)


def mad(values, med=None):
    if not values:
        return 0.0
    m = med if med is not None else median(values)
    return statistics.median([abs(v - m) for v in values])


def robust_z_score(value, history):
    """Returns 0 when there isn't enough history (fewer than 3 points) to judge deviation."""
    if len(history) < 3:
        return 0.0
    med = median(history)
    mad_val = mad(history, med)
    if mad_val == 0:
        if value == med:
            return 0.0
        return 3.5 if value > med else -3.5
    return (MAD_SCALE * (value - med)) / mad_val
