"""Check a value against a JSON Schema. Supports the keywords this project uses:
type (a name or a list of names, including "null"), enum, pattern, required, properties and items.
"""

import re

TYPES = {
    "string": str,
    "object": dict,
    "array": list,
    "boolean": bool,
    "integer": int,
    "number": (int, float),
    "null": type(None),
}


def errors(value, schema: dict, where: str = "$") -> list[str]:
    found = []
    kinds = schema.get("type")
    if kinds is not None:
        names = kinds if isinstance(kinds, list) else [kinds]
        if not any(isinstance(value, TYPES[name]) and not (name in ("integer", "number") and isinstance(value, bool)) for name in names):
            return [f"{where}: {value!r} is not {' or '.join(names)}"]
    if "enum" in schema and value not in schema["enum"]:
        found.append(f"{where}: {value!r} is not one of {schema['enum']}")
    if "pattern" in schema and isinstance(value, str) and not re.search(schema["pattern"], value):
        found.append(f"{where}: {value!r} does not match {schema['pattern']}")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                found.append(f"{where}: {key} is missing")
        for key, sub in schema.get("properties", {}).items():
            if key in value:
                found += errors(value[key], sub, f"{where}.{key}")
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            found += errors(item, schema["items"], f"{where}[{i}]")
    return found
