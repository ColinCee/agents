from importlib import import_module

ROUTES = {
    "import": "inventory.handlers:handle_import",
    "export": "inventory.handlers:handle_export",
    "report": "inventory.handlers:handle_report",
}


def dispatch(route: str, payload):
    if route not in ROUTES:
        raise KeyError(f"no such route: {route}")
    module, name = ROUTES[route].split(":")
    return getattr(import_module(module), name)(payload)
