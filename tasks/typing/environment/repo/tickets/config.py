"""Settings from the environment."""


def load(env: dict) -> dict:
    return {"timeout": env.get("TICKETS_TIMEOUT", "30"), "region": env.get("TICKETS_REGION", "eu")}
