"""
Shared landmark normalisation used by:
  - main.py          (saving recorded samples)
  - retrain.py       (loading dataset for training)
  - gesture_detector.py  (inference)

Two-step normalisation:
  1. Wrist subtraction  — translate all 21 points so wrist (landmark 0) is origin.
                          Makes features position-invariant (hand anywhere in frame).
  2. Scale normalisation — divide by the max absolute value across all coords.
                          Makes features scale-invariant (hand near/far from camera).
"""

import numpy as np


def normalize_landmarks(landmarks):
    """
    landmarks: list of 21 dicts  {'x': float, 'y': float, 'z': float}
               OR numpy array of shape (63,) in [x0,y0,z0, x1,y1,z1, ...] order

    Returns: flat numpy array of shape (63,), normalised.
    """
    if isinstance(landmarks, np.ndarray):
        coords = landmarks.reshape(21, 3).astype(float)
    else:
        coords = np.array([[lm["x"], lm["y"], lm["z"]] for lm in landmarks],
                          dtype=float)

    # Step 1 — wrist subtraction
    wrist  = coords[0].copy()
    coords -= wrist

    # Step 2 — scale normalisation
    scale = np.max(np.abs(coords))
    if scale > 0:
        coords /= scale

    return coords.flatten()


def normalize_landmarks_row(flat_row):
    """
    Convenience wrapper for a single CSV row (63 floats already extracted).
    flat_row: array-like of length 63
    Returns: flat numpy array of length 63.
    """
    return normalize_landmarks(np.array(flat_row, dtype=float))