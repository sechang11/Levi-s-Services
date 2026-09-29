#!/usr/bin/env python3
"""Queue Z-Image Turbo jobs on the local ComfyUI API and wait for results.
Stdlib only. Usage: python3 comfy_run.py jobs.json
jobs.json = [{"prefix": "levi/x", "prompt": "...", "w": 1920, "h": 1088, "seed": 1, "bg_remove": false}, ...]
Outputs land in ~/ComfyUI/output/<prefix>_00001_.png (+ _mask when bg_remove)."""
import json
import sys
import time
import urllib.request
import uuid

C = "http://127.0.0.1:8188"


def get(path):
    with urllib.request.urlopen(C + path, timeout=60) as r:
        return json.load(r)


def post(path, obj):
    req = urllib.request.Request(C + path, data=json.dumps(obj).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def zimage_graph(prompt, w, h, seed, prefix, steps, sampler, bg_remove):
    g = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_bf16.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "4": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3.0}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "6": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["5", 0]}},
        "7": {"class_type": "EmptySD3LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "8": {"class_type": "KSampler", "inputs": {
            "model": ["4", 0], "seed": seed, "steps": steps, "cfg": 1.0,
            "sampler_name": sampler, "scheduler": "simple",
            "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0], "denoise": 1.0}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": prefix}},
    }
    if bg_remove:
        g["11"] = {"class_type": "LoadBackgroundRemovalModel", "inputs": {"bg_removal_name": "birefnet.safetensors"}}
        g["12"] = {"class_type": "RemoveBackground", "inputs": {"bg_removal_model": ["11", 0], "image": ["9", 0]}}
        g["13"] = {"class_type": "MaskToImage", "inputs": {"mask": ["12", 0]}}
        g["14"] = {"class_type": "SaveImage", "inputs": {"images": ["13", 0], "filename_prefix": prefix + "_mask"}}
    return g


def main():
    path = sys.argv[1]
    jobs = json.load(open(path))
    samplers = get("/object_info/KSampler")["KSampler"]["input"]["required"]["sampler_name"][0]
    sampler = "res_multistep" if "res_multistep" in samplers else "euler"
    client = str(uuid.uuid4())
    pending = {}
    for j in jobs:
        g = zimage_graph(j["prompt"], j["w"], j["h"], j["seed"], j["prefix"], j.get("steps", 9), sampler, j.get("bg_remove", False))
        r = post("/prompt", {"prompt": g, "client_id": client})
        if r.get("node_errors"):
            print("node errors:", j["prefix"], r["node_errors"]); sys.exit(1)
        pending[j["prefix"]] = r["prompt_id"]
    print(f"queued {len(pending)} jobs (sampler={sampler})", flush=True)

    t0 = time.time()
    results = {}
    while pending and time.time() - t0 < 3600:
        time.sleep(2)
        for prefix, pid in list(pending.items()):
            h = get(f"/history/{pid}")
            if pid not in h:
                continue
            st = h[pid].get("status", {})
            files = [f'{im.get("subfolder", "")}/{im["filename"]}'
                     for out in h[pid].get("outputs", {}).values() for im in out.get("images", [])]
            results[prefix] = {"status": st.get("status_str"), "files": files}
            print(f"[{time.time() - t0:6.1f}s] {prefix}: {st.get('status_str')} {files}", flush=True)
            if st.get("status_str") == "error":
                for m in st.get("messages", []):
                    if m[0] == "execution_error":
                        print("   ", m[1].get("exception_message", "")[:400])
            del pending[prefix]
    json.dump(results, open(path + ".out.json", "w"), indent=1)
    print("done" if not pending else f"timed out with {len(pending)} pending")


if __name__ == "__main__":
    main()
