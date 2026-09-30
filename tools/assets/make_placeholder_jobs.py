#!/usr/bin/env python3
"""Placeholder job photos: 6 per service + 5 Woodshop pieces, photoreal, no people.
Every image gets a burned-in PLACEHOLDER label later (process_placeholders.py): these
stand in until Levi's real job photos arrive and must never pass as his work.

  python3 make_placeholder_jobs.py a.json        # phase A: Z-Image Turbo, everything but the "after" shots
  python3 make_placeholder_jobs.py b.json --after # phase B: Qwen-Image-Edit turns each "before" into its
                                                   # matching "after" (same camera, same room), for the
                                                   # site's before/after slider. Run after phase A.
Outputs: ~/ComfyUI/output/levi/ph/<service>_<shot>_00001_.png"""
import json
import os
import shutil
import sys

# (no camera words: "full-frame camera, 24-70mm lens" put actual cameras into the scenes)
STYLE = (" Realistic professional photograph for a local contractor's portfolio, natural light, true-to-life colors, "
         "sharp focus, high detail. No people, no cameras, no text, no logos, no watermark.")
PRODUCT = (" Professional furniture photograph, handcrafted solid wood, soft natural window light, true-to-life "
           "colors, sharp focus, shallow depth of field. No people, no cameras, no text, no logos, no watermark.")

# shot keys follow the site's gallery order (public/js/content.js)
SERVICES = {
    "demolition": {
        "wide": "Interior of a house gutted down to the studs during a renovation, exposed wood framing and clean subfloor, debris swept into neat piles, contractor bags and a wheelbarrow, window light, wide angle.",
        "before": "A dated 1990s kitchen before renovation: honey oak cabinets, beige laminate countertops, worn vinyl floor, old white appliances, fluorescent ceiling light, wide shot from the doorway.",
        "progress": "Kitchen demolition in progress: the cabinets are gone, drywall half torn off exposing the wood studs, broken drywall pieces on a protected floor, a sledgehammer leaning on a stud, a plastic dust barrier over the doorway.",
        "detail": "Close-up of a pry bar and claw hammer on a plywood subfloor beside neatly stacked salvaged boards with the nails pulled, a little dust in the light, shallow depth of field.",
        "finish": "A roll-off dumpster in a residential driveway loaded with demolition debris and covered with a tarp, house in the background, overcast daylight.",
        "after": "Edit this photo: remove every cabinet, countertop, appliance and the vinyl floor, and strip the walls down to bare wood studs over a clean plywood subfloor, swept broom-clean. Do not move the camera: the room shape, ceiling light, doorway and wall positions stay exactly where they are in this photo.",
    },
    "framing": {
        "wide": "A new home addition framed in fresh yellow lumber: wall studs, headers and roof rafters against a clear blue sky, tidy job site with a lumber stack.",
        "before": "An empty unfinished basement with a bare concrete floor, gray concrete block walls, exposed floor joists overhead and a single work light, wide shot.",
        "progress": "A basement being framed: new 2x4 stud walls on pressure-treated bottom plates over a concrete floor, a framing nailer, chalk lines and a neat stack of lumber.",
        "detail": "Close-up of a precise wood framing joint: a doubled header over a door opening with jack studs, a steel framing square and a carpenter's pencil resting on it, fresh sawdust.",
        "finish": "Finish carpentry: painted white built-in bookshelves with crisp trim and crown molding in a bright living room, soft daylight.",
        "after": "Show the same basement after framing: new straight 2x4 stud walls framed along the block walls with a door opening, fresh lumber, clean swept floor. Keep the exact same camera angle, framing, joists and lighting.",
    },
    "drywall": {
        "wide": "A freshly painted empty living room with smooth warm white walls, a crisp ceiling line, clean wood floors and natural light from large windows.",
        "before": "An empty living room with damaged drywall: a brown water stain on the ceiling, cracked and patched walls, scuffed yellowed old paint, dated light fixture.",
        "progress": "Drywall being finished: taped seams covered with joint compound, a sanding pole, mud pan and taping knife on a step ladder, drop cloths covering the floor.",
        "detail": "Close-up of a painter's angled brush cutting in a perfectly straight line where a white ceiling meets a sage green wall.",
        "finish": "A bedroom with a freshly painted deep navy accent wall and bright white trim, styled with a made bed and a brass lamp, soft morning light.",
        "after": "Show the same room after drywall repair and fresh paint: smooth flawless walls and ceiling in warm white, the stain and cracks gone, a clean modern light fixture. Keep the exact same camera angle, framing, windows and lighting.",
    },
    "decks": {
        "wide": "A new cedar wood deck on the back of a suburban house with wide stairs, black metal balusters, simple outdoor furniture and a green lawn, golden hour light.",
        "before": "An old weathered gray wooden deck behind a house with cracked boards, peeling stain and a leaning railing, overgrown lawn, daylight.",
        "progress": "A deck under construction: pressure-treated joists and beams on concrete footings with galvanized joist hangers, half the new deck boards installed, a circular saw on sawhorses.",
        "detail": "Close-up of new cedar deck boards with hidden fasteners, clean even gaps and a picture-frame border board, fresh wood grain.",
        "finish": "A new horizontal cedar privacy fence along a backyard with a green lawn and a mulched garden bed, late afternoon light.",
        "after": "Show the same deck completely rebuilt: new smooth cedar deck boards and a new railing with black metal balusters, clean and freshly stained, tidy lawn. Keep the exact same camera angle, framing, house and lighting.",
    },
    "flooring": {
        "wide": "An open living area with new wide-plank light oak floors, white walls, large windows and minimal furniture, bright natural light.",
        "before": "An empty room with old stained beige carpet, worn scuffed baseboards and dull walls, daylight from one window.",
        "progress": "Flooring installation in progress: new vinyl plank flooring half installed over underlayment, spacers along the wall, a rubber mallet and tapping block, open boxes of flooring.",
        "detail": "Close-up of a herringbone tile floor with perfectly aligned narrow grout lines, level and clean, raking light.",
        "finish": "A modern bathroom with large-format porcelain floor tile and a tiled walk-in shower with a built-in niche, clean grout lines.",
        "after": "Show the same room with the carpet replaced by new wide-plank light oak flooring and fresh white baseboards, clean and bright. Keep the exact same camera angle, framing, walls, window and lighting.",
    },
    "kitchen": {
        "wide": "A remodeled modern kitchen with white shaker cabinets, white quartz countertops, subway tile backsplash, brass hardware and pendant lights over an island, natural light.",
        "before": "A dated kitchen with dark cherry cabinets, speckled brown granite countertops, a beige tile backsplash and old black appliances, dim light.",
        "progress": "A kitchen remodel in progress: new base cabinets installed with no countertops yet, a level resting on the cabinets, plumbing rough-in, tools and cardboard on the floor.",
        "detail": "Close-up of a white quartz countertop edge meeting a white subway tile backsplash beside a brushed brass faucet, a few water droplets.",
        "finish": "A remodeled bathroom with a floating walnut vanity, matte black fixtures, a large round mirror and marble-look tile, soft light.",
        "after": "Edit this photo: repaint the same cabinets as white shaker cabinets with brass pulls, replace the granite with white quartz countertops, the tan backsplash with white subway tile and the black range with a stainless one. Do not move the camera or change the layout: every cabinet, the island, the range hood and the walls stay exactly where they are in this photo.",
    },
    "roofing": {
        "wide": "A two-story house with a brand-new charcoal architectural shingle roof and white seamless gutters, blue sky, suburban street.",
        "before": "An old worn asphalt shingle roof on a house with curling and missing shingles, moss and a sagging gutter, overcast day.",
        "progress": "A roof replacement in progress: old shingles torn off, new gray synthetic underlayment and metal drip edge installed, bundles of new shingles and a roofing nailer on the roof.",
        "detail": "Close-up of new architectural shingles and metal step flashing along a brick chimney, neatly sealed.",
        "finish": "Close-up of a new seamless copper gutter and downspout on a house with orange autumn leaves, clean lines.",
        "after": "Show the same house after a roof replacement: brand-new charcoal architectural shingles and new white seamless gutters, clean and straight. Keep the exact same camera angle, framing, house and lighting.",
    },
    "concrete": {
        "wide": "A new broom-finished concrete driveway and front walkway leading to a house, clean straight edges, fresh landscaping, morning light.",
        "before": "A cracked and heaved old concrete walkway with weeds growing through the cracks leading to a front porch, daylight.",
        "progress": "Fresh concrete being finished: wooden forms along a new walkway, wet gray concrete, a bull float and an edging tool, rebar visible at the end.",
        "detail": "Close-up of a freshly tooled concrete control joint and rounded edge with a crisp broom-finish texture.",
        "finish": "A repointed red brick wall with fresh even mortar joints beside new brick steps, clean craftsmanship, daylight.",
        "after": "Show the same walkway replaced with smooth new concrete with clean control joints and crisp edges, the weeds gone, tidy lawn edges. Keep the exact same camera angle, framing, porch and lighting.",
    },
    "snow": {
        "driveway": "A residential driveway shoveled completely clean down to dry black asphalt after a heavy snowfall, crisp straight edges with tall snowbanks piled on both sides, a house with warm lit windows at the end, early morning blue hour.",
        "walkway": "A shoveled front walkway cut through deep snow leading to a front door with a wreath, clean straight edges and a few salt granules, soft morning light.",
        "steps": "Front porch steps cleared of snow and salted, a black railing, snow piled neatly beside the steps, warm porch light at dawn.",
        "sidewalk": "A residential sidewalk in front of houses cleared of snow down to the pavement, neat snowbanks along the curb, bright winter morning.",
        "night": "A residential driveway at night freshly cleared of snow, large pushed snow piles, snowflakes falling in the glow of a streetlight, a snow blower parked by the garage.",
        # the before half of the gallery's "Before / after" shot, edited from the cleared driveway
        "snowy": "Show the same driveway before clearing: completely buried under a foot of fresh untouched snow with deep drifts, snow on the house and trees. Keep the exact same camera angle, framing, house, windows and lighting.",
    },
}

WOODSHOP = {
    "table": "A live-edge walnut dining table with black steel trestle legs in a bright dining room, simple chairs, natural light.",
    "bench": "A bench made of natural white oak with visible wood grain and a clear oil finish, not painted, splayed legs, in a bright entryway with a woven basket, minimal styling.",
    "shelves": "Three floating walnut shelves on a white wall holding books, a small plant and a ceramic vase.",
    "board": "An end-grain checkerboard cutting board in maple and walnut on a kitchen counter with a chef's knife and fresh herbs.",
    "nightstand": "A mid-century walnut nightstand with one drawer and tapered legs beside a bed, a small lamp and a book on top.",
}

EDITS = {s: ("before", "after") for s in SERVICES if s != "snow"}
EDITS["snow"] = ("driveway", "snowy")  # source shot → edited shot
W, H = 1536, 864


def main():
    """make_placeholder_jobs.py out.json [--after] [--only svc_shot,svc_shot --seed N]"""
    out, after = sys.argv[1], "--after" in sys.argv
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 11
    jobs = []
    if not after:
        for svc, shots in SERVICES.items():
            for key, prompt in shots.items():
                if key == EDITS[svc][1]:
                    continue
                if only is None or f"{svc}_{key}" in only:
                    jobs.append({"prefix": f"levi/ph/{svc}_{key}", "prompt": prompt + STYLE, "w": W, "h": H, "seed": seed})
        for key, prompt in WOODSHOP.items():
            if only is None or f"woodshop_{key}" in only:
                jobs.append({"prefix": f"levi/ph/woodshop_{key}", "prompt": prompt + PRODUCT, "w": W, "h": H, "seed": seed})
    else:
        comfy = os.path.expanduser("~/ComfyUI")
        for svc, (src, dst) in EDITS.items():
            ref = f"levi_ph_{svc}_{src}.png"   # Qwen-Image-Edit's LoadImage reads from ComfyUI/input
            shutil.copyfile(f"{comfy}/output/levi/ph/{svc}_{src}_00001_.png", f"{comfy}/input/{ref}")
            if only is not None and f"{svc}_{dst}" not in only:
                continue
            jobs.append({"kind": "qwen_edit", "ref": ref, "prefix": f"levi/ph/{svc}_{dst}",
                         "prompt": SERVICES[svc][dst] + " Photorealistic, same photographic style as the reference. No people, no text.",
                         "w": W, "h": H, "seed": seed, "lightning": False})
    json.dump(jobs, open(out, "w"), indent=1)
    print(len(jobs), "jobs")


if __name__ == "__main__":
    main()
