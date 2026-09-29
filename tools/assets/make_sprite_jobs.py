#!/usr/bin/env python3
"""Write jobs for seasonal particle sprites (generated + background-removed with BiRefNet)."""
import json
import sys

FLAT = ("isolated and centered, photographed from directly above as a flat lay on a plain seamless light gray paper background, "
        "soft even studio lighting, crisp clean edges, true-to-life color and texture, macro product photography, "
        "high detail, nothing else in the frame.")

SPRITES = {
    # fall
    "fall_maple_red": "A single vivid red autumn maple leaf with five pointed lobes and a short stem,",
    "fall_maple_orange": "A single bright orange autumn maple leaf with visible veins and a short stem,",
    "fall_birch_gold": "A single small golden yellow birch leaf with a serrated edge,",
    "fall_oak_brown": "A single rust brown autumn oak leaf with rounded lobes,",
    "fall_ginkgo_yellow": "A single fan-shaped golden yellow ginkgo leaf with a thin stem,",
    "fall_maple_crimson": "A single deep crimson and burgundy autumn maple leaf,",
    # spring
    "spring_petal_pink": "A single soft pink cherry blossom petal, delicate and slightly curled, notched tip,",
    "spring_petal_white": "A single white cherry blossom petal with a faint pink blush at the base, delicate,",
    "spring_blossom_pink": "A single small pink cherry blossom flower with five petals and tiny stamens,",
    "spring_lilac_floret": "A single tiny purple lilac floret with four petals,",
    "spring_leaf_green": "A single small fresh bright green spring leaf,",
}
SNOW = {
    "winter_flake_a": "A single intricate six-pointed snowflake ice crystal with fern-like branches,",
    "winter_flake_b": "A single simple six-pointed star snowflake ice crystal with broad plate arms,",
    "winter_flake_c": "A single delicate hexagonal snowflake ice crystal with fine needle branches,",
}
SNOW_BG = ("macro photograph, centered, on a plain seamless deep navy blue background, crisp sharp edges, "
           "sparkling, high detail, nothing else in the frame.")


def main():
    jobs = []
    for name, desc in SPRITES.items():
        for seed in (101, 202):
            jobs.append({"prefix": f"levi/sprites/{name}_s{seed}", "prompt": f"{desc} {FLAT}",
                         "w": 1024, "h": 1024, "seed": seed, "bg_remove": True})
    for name, desc in SNOW.items():
        for seed in (303, 404):
            jobs.append({"prefix": f"levi/sprites/{name}_s{seed}", "prompt": f"{desc} {SNOW_BG}",
                         "w": 1024, "h": 1024, "seed": seed, "bg_remove": True})
    json.dump(jobs, open(sys.argv[1], "w"), indent=1)
    print(len(jobs), "jobs")


if __name__ == "__main__":
    main()
