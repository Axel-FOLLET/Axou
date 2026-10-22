import time

WINDOW_SECONDS = 900
MAX_ATTEMPTS = 5

_failures = {}

def _get_recent_failures(email):
    now = time.monotonic()

    recent = [
        attempt
        for attempt in _failures.get(email, [])
        if now - attempt < WINDOW_SECONDS
    ]

    if recent:
        _failures[email] = recent
    else:
        _failures.pop(email, None)

    return recent

def seconds_blocked(email):
    recent = _get_recent_failures(email)

    if len(recent) < MAX_ATTEMPTS:
        return 0

    now = time.monotonic()
    remaining = WINDOW_SECONDS - (now - recent[0])

    return max(1, int(remaining + 0.999))

def record_failure(email):
    recent = _get_recent_failures(email)
    recent.append(time.monotonic())
    _failures[email] = recent

def reset(email):
    _failures.pop(email, None)