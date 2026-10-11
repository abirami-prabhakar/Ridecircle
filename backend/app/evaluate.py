"""Evaluate extraction against hand-labeled preferences without training a model."""
import argparse
import asyncio
import json
from pathlib import Path
from time import perf_counter
from fastapi import HTTPException
from .ai import extract
from .config import settings


async def run(path):
    samples = json.loads(path.read_text(encoding="utf-8"))
    valid = exact = correct = fields = 0
    times = []
    for sample in samples:
        started = perf_counter()
        try:
            intent, engine, _ = await extract(sample["query"])
            output = intent.model_dump(mode="json")
            valid += 1
            matches = [output.get(key) == value for key, value in sample["expected"].items()]
            exact += all(matches)
            correct += sum(matches)
            fields += len(matches)
            print(json.dumps({"query":sample["query"],"expected":sample["expected"],"actual":output,"pass":all(matches)},ensure_ascii=False))
        except HTTPException as error:
            if sample.get("expected_error") == error.status_code:
                exact += 1
            print(json.dumps({"query":sample["query"],"error":error.detail}))
        times.append(perf_counter()-started)
    print(json.dumps({"mode":settings.ai_mode,"samples":len(samples),"valid_outputs":valid,"exact_matches":exact,
                      "field_accuracy":round(correct/fields,3) if fields else 0,"median_seconds":sorted(times)[len(times)//2]},indent=2))
    return exact == len(samples)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file",type=Path)
    raise SystemExit(0 if asyncio.run(run(parser.parse_args().file)) else 1)
