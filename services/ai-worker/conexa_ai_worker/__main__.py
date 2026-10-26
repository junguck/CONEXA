"""Process one event from stdin and print the produced events as JSON.

Usage:
    python3 -m conexa_ai_worker < event.json
"""

from __future__ import annotations

import json
import sys

from .events import DatingWorker, InvalidEvent


def main() -> int:
    try:
        event = json.load(sys.stdin)
        produced = DatingWorker().handle(event)
    except json.JSONDecodeError:
        print("invalid JSON on stdin", file=sys.stderr)
        return 2
    except InvalidEvent as exc:
        print(f"invalid event: {exc}", file=sys.stderr)
        return 1
    json.dump(produced, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
