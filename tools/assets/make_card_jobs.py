#!/usr/bin/env python3
"""Business-card front illustrations: Levi (reference = his site cartoon in that season's outfit)
restaged doing each season's featured service. Plus a walnut grain texture for the woodshop."""
import json
import sys

KEEP = ("Keep his face, skin tone, short beard and moustache, long dreadlocks with metal cuffs, "
        "earrings and gold chain exactly the same as in the reference image. ")
STYLE = ("Render it as a polished flat vector illustration in the same art style as the reference: "
         "clean simple shapes, smooth soft gradients, crisp edges, bold cinematic lighting, rich slightly muted colors. "
         "Wide landscape composition: Levi stands on the right half of the frame; the left third of the frame is calmer "
         "with open negative space. No text, no letters, no logos, no watermark.")

SCENES = {
    "winter": ("Show this same man, full body, cheerfully shoveling snow off a residential driveway at night with a snow shovel. "
               "He wears a red Santa hat with white fur trim and a pom-pom instead of the beanie, his purple knit scarf, "
               "a navy puffer jacket, work gloves and boots. A freshly cleared driveway and walkway lead to a cozy house "
               "with warm glowing windows and string lights; tall snowbanks on both sides, snowflakes falling, "
               "a deep indigo and violet night sky."),
    "spring": ("Show this same man, full body, kneeling and smoothing a freshly poured concrete walkway with a hand trowel. "
               "He wears his green varsity jacket with cream sleeves and the purple L patch, jeans and work boots. "
               "Blooming lilac and pink cherry blossom trees around him, petals drifting, a fresh green lawn, "
               "soft pre-dawn light under a teal and lilac sky."),
    "summer": ("Show this same man, full body, building a new cedar wood deck at sunset, hammering a deck board, "
               "with a leather tool belt on his waist. He wears his cream t-shirt, gold chain and gold sunglasses "
               "pushed up on his head, work pants and boots. String lights overhead, a horizontal-slat privacy fence, "
               "fireflies, a warm magenta and orange sunset sky."),
    "fall": ("Show this same man, full body, standing on an aluminum ladder installing a shiny copper seamless gutter "
             "along the edge of a new dark shingle roof. He wears his rust red plaid flannel shirt, work pants and boots. "
             "Orange and red maple leaves swirl through the air, a pumpkin by the porch steps, "
             "a plum and burnt orange dusk sky."),
}

# year-round "Classic" card: a studio portrait on a plain background, cut out with BiRefNet so the
# card's own inked background shows through
CLASSIC = ("Show this same man as a waist-up portrait facing the viewer with a confident, friendly smile, "
           "arms crossed. He wears a fitted black t-shirt, his gold chain and a brown leather tool belt, "
           "with a flat carpenter's pencil tucked behind one ear. Plain flat dark navy blue studio background "
           "with a soft warm gold rim light behind him, centered composition. ")

WOOD = ("Macro texture photograph of dark oiled walnut wood, a single wide board seen straight on from above, "
        "rich chocolate brown with subtle cathedral grain figure, fine pores and a soft satin sheen, "
        "even soft lighting, no knots, no cracks, fills the entire frame edge to edge, photorealistic, high detail.")


def main():
    """make_card_jobs.py out.json [winter spring summer fall classic wood] — no filter = everything."""
    want = set(sys.argv[2:]) or {*SCENES, "classic", "wood"}
    jobs = []
    for season, scene in SCENES.items():
        if season not in want:
            continue
        prompt = f"{scene} {KEEP}{STYLE}"
        for seed in (7, 19, 31):
            jobs.append({"kind": "qwen_edit", "ref": f"levi_ref_{season}.png", "prefix": f"levi/cards/{season}_L_s{seed}",
                         "prompt": prompt, "w": 1344, "h": 800, "seed": seed, "lightning": True})
        for seed in (43, 59):
            jobs.append({"kind": "qwen_edit", "ref": f"levi_ref_{season}.png", "prefix": f"levi/cards/{season}_F_s{seed}",
                         "prompt": prompt, "w": 1344, "h": 800, "seed": seed, "lightning": False})
    if "classic" in want:
        style = STYLE.split(" Wide landscape composition")[0] + " No text, no letters, no logos, no watermark."
        for seed, lightning in ((7, True), (19, True), (31, True), (43, False), (59, False)):
            jobs.append({"kind": "qwen_edit", "ref": "levi_ref_summer.png", "prefix": f"levi/cards/classic_{'L' if lightning else 'F'}_s{seed}",
                         "prompt": f"{CLASSIC}{KEEP}{style}", "w": 1024, "h": 1024, "seed": seed,
                         "lightning": lightning, "bg_remove": True})
    if "wood" in want:
        for seed in (5, 17):
            jobs.append({"prefix": f"levi/wood/walnut_s{seed}", "prompt": WOOD, "w": 1920, "h": 1088, "seed": seed})
    json.dump(jobs, open(sys.argv[1], "w"), indent=1)
    print(len(jobs), "jobs")


if __name__ == "__main__":
    main()
