"""Median / MAD / robust z-score — deliberately not mean/stdev, since a single
heavy-usage day shouldn't blow out the baseline the way an outlier-sensitive
mean would (Phase 6 of the CalmSense research architecture)."""
import math
import statistics

MAD_SCALE = 0.6745  # normal-consistency constant

# Sentinel z-score for "history was perfectly constant and this value isn't
# it" — comfortably past Z_THRESHOLD (2.5) so it reads as anomalous without
# claiming a precise magnitude we have no spread data to back up.
CONSTANT_HISTORY_DEPARTURE_Z = 10.0


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
        # A truly matching value is correctly "not anomalous" — but a value
        # that differs at all from a baseline with zero observed spread is
        # actually a *stronger* signal than one from a noisy baseline, not a
        # weaker one: it's the difference between "unlike anything we've ever
        # seen at this time" and "a bit high for a range that varies anyway".
        # This matters in practice — real same-slot baselines are very often
        # constant (e.g. always-0 overnight windows), and treating that as
        # "can't judge" was silently blinding the detector at exactly those
        # slots, no matter how extreme the actual value was.
        if value == med:
            return 0.0
        return math.copysign(CONSTANT_HISTORY_DEPARTURE_Z, value - med)
    return (MAD_SCALE * (value - med)) / mad_val
