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
        # MAD is median-based, so it reads as 0 whenever more than half the
        # history is identical even if the rest isn't — stdev still picks up
        # that spread, so try it before giving up on measuring variability.
        stdev_val = statistics.pstdev(history)
        if stdev_val > 0:
            return (value - med) / stdev_val
        # History is genuinely constant (real variance, not just MAD, is 0).
        # With a short study (few data points per slot) this is common and
        # doesn't mean "any deviation is extreme" — it means we don't have
        # enough spread info to judge the deviation's size at all, so treat
        # it the same as insufficient history rather than forcing a hard
        # +/-3.5 that would flag even a trivial one-unit change as anomalous.
        return 0.0
    return (MAD_SCALE * (value - med)) / mad_val
