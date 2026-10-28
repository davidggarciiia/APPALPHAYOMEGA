"""Original exercise poses in metres, independent of Blender.

X is lateral, Y runs toward the head of a reclining person (behind a
standing person), and Z is up. End-effector paths drive two-bone inverse
kinematics, so the same mannequin keeps its proportions throughout a loop.
"""

import math


_UPPER_ARM = 0.30
_FOREARM = 0.275
_THIGH = 0.425
_SHIN = 0.435


def movimientos():
    return ("press-inclinado", "remo-polea", "dead-bug")


def _subtract(a, b):
    return tuple(x - y for x, y in zip(a, b))


def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def _interpolate(a, b, amount):
    return tuple(x + (y - x) * amount for x, y in zip(a, b))


def _joint(root, target, proximal, distal, pole):
    """Solve the intermediate joint without changing a reachable target.

    The pole is a direction from the root. Its perpendicular component
    selects the bend plane and which side the elbow or knee bends toward.
    """
    delta = _subtract(target, root)
    distance = math.sqrt(_dot(delta, delta))
    if not abs(proximal - distal) < distance < proximal + distal:
        raise ValueError("El objetivo debe permitir flexión de ambos segmentos")
    direction = tuple(x / distance for x in delta)
    projection = _dot(pole, direction)
    bend = tuple(p - projection * d for p, d in zip(pole, direction))
    bend_length = math.sqrt(_dot(bend, bend))
    if bend_length < 1e-12:
        # A deterministic perpendicular also covers a pole parallel to the limb.
        axis = min(range(3), key=lambda i: abs(direction[i]))
        fallback = tuple(1.0 if i == axis else 0.0 for i in range(3))
        projection = _dot(fallback, direction)
        bend = tuple(p - projection * d for p, d in zip(fallback, direction))
        bend_length = math.sqrt(_dot(bend, bend))
    along = (proximal * proximal - distal * distal + distance * distance) / (2 * distance)
    height = math.sqrt(max(0.0, proximal * proximal - along * along))
    return tuple(r + along * d + height * b / bend_length
                 for r, d, b in zip(root, direction, bend))


def _limbs(points, side, hip, shoulder, ankle, wrist, elbow_pole, knee_pole):
    points[f"{side}_hip"] = hip
    points[f"{side}_shoulder"] = shoulder
    points[f"{side}_ankle"] = ankle
    points[f"{side}_wrist"] = wrist
    points[f"{side}_elbow"] = _joint(shoulder, wrist, _UPPER_ARM, _FOREARM, elbow_pole)
    points[f"{side}_knee"] = _joint(hip, ankle, _THIGH, _SHIN, knee_pole)


def _press(amount):
    points = {"pelvis": (0.0, 0.0, 0.61),
              "chest": (0.0, 0.45, 0.87),
              "head": (0.0, 0.66, 1.02)}
    for side, sign in (("l", -1.0), ("r", 1.0)):
        wrist = _interpolate((sign * 0.43, 0.29, 1.12),
                             (sign * 0.21, 0.44, 1.43), amount)
        _limbs(points, side, (sign * 0.11, 0.0, 0.60),
               (sign * 0.205, 0.44, 0.87), (sign * 0.16, -0.53, 0.10),
               wrist, (sign, -0.05, -0.4), (0.0, -0.3, 1.0))
    return points


def _row(amount):
    points = {"pelvis": (0.0, 0.0, 0.64),
              "chest": (0.0, 0.0, 1.16),
              "head": (0.0, 0.0, 1.42)}
    for side, sign in (("l", -1.0), ("r", 1.0)):
        wrist = _interpolate((sign * 0.13, -0.53, 1.02),
                             (sign * 0.13, -0.08, 0.865), amount)
        _limbs(points, side, (sign * 0.11, 0.0, 0.63),
               (sign * 0.205, 0.0, 1.18), (sign * 0.16, -0.66, 0.13),
               wrist, (sign * 0.25, 0.8, -0.3), (0.0, -0.3, 1.0))
    return points


def _dead_bug(first, second):
    points = {"pelvis": (0.0, 0.0, 0.145),
              "chest": (0.0, 0.52, 0.145),
              "head": (0.0, 0.77, 0.13)}
    for side, sign, arm_amount, leg_amount in (("l", -1.0, first, second),
                                              ("r", 1.0, second, first)):
        # A shoulder-centred arc preserves a small elbow bend overhead.
        angle = arm_amount * math.atan2(0.555, 0.06)
        radius = 0.565 + (math.hypot(0.555, 0.06) - 0.565) * arm_amount
        wrist = (sign * 0.205, 0.51 + radius * math.sin(angle),
                 0.155 + radius * math.cos(angle))
        ankle = _interpolate((sign * 0.13, -0.43, 0.570),
                             (sign * 0.13, -0.84, 0.185), leg_amount)
        _limbs(points, side, (sign * 0.11, 0.0, 0.145),
               (sign * 0.205, 0.51, 0.155), ankle, wrist,
               (sign * 0.18, -1.0, 0.15), (0.0, 0.0, 1.0))
    return points


def pose(nombre, fase):
    """Return joint positions for a normalized phase from zero to one.

    Each end of the loop returns exactly the same pose. The raised-cosine
    timing pauses smoothly at the direction changes without moving the trunk.
    """
    if nombre not in movimientos():
        raise ValueError(f"Movimiento desconocido: {nombre}")
    phase = float(fase)
    if not math.isfinite(phase) or not 0.0 <= phase <= 1.0:
        raise ValueError("La fase debe estar entre 0 y 1")
    if phase == 1.0:
        phase = 0.0
    if nombre == "dead-bug":
        if phase < 0.5:
            return _dead_bug(math.sin(math.tau * phase) ** 2, 0.0)
        return _dead_bug(0.0, math.sin(math.tau * (phase - 0.5)) ** 2)
    amount = (1.0 - math.cos(math.tau * phase)) / 2.0
    return _press(amount) if nombre == "press-inclinado" else _row(amount)
