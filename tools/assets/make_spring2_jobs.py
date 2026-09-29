#!/usr/bin/env python3
"""Spring, take 2: low-key pre-dawn so it matches the other seasons' dark, moody hero."""
import json
import sys

import make_backdrop_jobs as base

SPRING = (
    "Cinematic pre-dawn photograph of a charming house front in early spring, in the deep blue-green twilight just before sunrise. "
    "Blooming lilac bushes and pink cherry blossom trees frame the left and right edges, softly lit, a few petals drifting in the air. "
    "A brand-new poured concrete walkway and wide front steps, clean and pale, curve across a lush dewy green lawn toward the porch, "
    "where a warm porch light glows. Low mist hangs over the lawn. "
    "The sky is dark and moody at the top, deep teal and plum, with only a faint lilac and mint glow near the horizon. "
    "Low-key lighting, dark and atmospheric."
)


def main():
    jobs = []
    for fmt, (framing, w, h) in base.FRAMING.items():
        for s in ({"desk": [11, 23, 37, 41, 59, 83], "mob": [53, 67, 71, 97]}[fmt]):
            jobs.append({"prefix": f"levi/bg/spring2_{fmt}_s{s}", "prompt": f"{SPRING} {framing} {base.STYLE}",
                         "w": w, "h": h, "seed": s})
    json.dump(jobs, open(sys.argv[1], "w"), indent=1)
    print(len(jobs), "jobs")


if __name__ == "__main__":
    main()
