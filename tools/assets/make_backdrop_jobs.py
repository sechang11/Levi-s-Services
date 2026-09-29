#!/usr/bin/env python3
"""Write jobs for the seasonal hero backdrops (desktop 16:9 + mobile 9:16)."""
import json
import sys

STYLE = ("Shot on a full-frame cinema camera, 35mm lens, shallow depth of field, soft bokeh, "
         "subtle film grain, rich cinematic color grade, deep natural vignette at the frame edges, "
         "photorealistic, highly detailed, quiet and empty, nobody in the scene.")

SCENES = {
    "winter": (
        "Cinematic blue-hour photograph of a quiet suburban street right after a heavy snowfall. "
        "A cozy two-story craftsman house with warm amber light glowing from its windows and porch lantern. "
        "In front of it, a freshly cleared driveway and a crisp shoveled walkway lead to the front door, "
        "with neat straight-edged snowbanks piled on both sides: the only clear path through a thick blanket of fresh snow. "
        "Soft snowflakes drift through the cold air, catching the glow of a vintage streetlamp. "
        "Snow-laden pine trees frame the left and right edges. "
        "A deep indigo and violet sky with faint lavender clouds, cool ice-blue shadows on the snow."
    ),
    "spring": (
        "Cinematic dawn photograph of a charming house front in early spring. "
        "Blooming lilac bushes and pink cherry blossom trees frame the left and right edges, a few petals drifting in the air. "
        "A brand-new poured concrete walkway and wide front steps, clean and pale, curve across a lush fresh green lawn toward the porch. "
        "Soft morning mist and dew, gentle warm light peeking through. "
        "An open, softly glowing sky in muted lilac and mint tones."
    ),
    "summer": (
        "Cinematic golden-hour photograph of a backyard at sunset in midsummer. "
        "A beautiful new cedar wood deck with clean railings and a tall horizontal-slat privacy fence, "
        "warm string lights draped overhead, a few fireflies glowing above the long grass. "
        "The sun sets behind trees on the right, creating a warm hazy glow and gentle lens flare. "
        "A dramatic sky in magenta, coral and burnt orange with soft wispy clouds, deep plum shadows."
    ),
    "fall": (
        "Cinematic dusk photograph of a craftsman house in peak autumn. "
        "A crisp new dark charcoal shingle roof with gleaming copper seamless gutters and downspouts, "
        "warm lamp light glowing from the windows and porch. "
        "Maple trees with fiery orange, red and gold leaves frame the left and right edges; "
        "fallen leaves scatter across the lawn and walkway, a few leaves drifting in the air. "
        "A deep twilight sky blending plum, dusky purple and burnt orange."
    ),
}

FRAMING = {
    "desk": ("Wide establishing shot from a low camera angle: the house and yard sit in the lower third of the frame, "
             "and a vast calm sky fills the upper two thirds as open negative space.", 1920, 1088),
    "mob": ("Tall vertical composition from a low camera angle: the house and yard sit at the very bottom of the frame, "
            "and a tall calm sky fills the upper two thirds as open negative space.", 1088, 1920),
}


def main():
    seeds = {"desk": [11, 23, 37, 41], "mob": [53, 67, 71]}
    jobs = []
    for season, scene in SCENES.items():
        for fmt, (framing, w, h) in FRAMING.items():
            for s in seeds[fmt]:
                jobs.append({
                    "prefix": f"levi/bg/{season}_{fmt}_s{s}",
                    "prompt": f"{scene} {framing} {STYLE}",
                    "w": w, "h": h, "seed": s,
                })
    json.dump(jobs, open(sys.argv[1], "w"), indent=1)
    print(len(jobs), "jobs")


if __name__ == "__main__":
    main()
