"""Shared schema helpers (Step 5a)."""


def clean_text(v: str | None, max_len: int) -> str | None:
    """Strip a nullable free-text value, map blank -> None, enforce length."""
    if v is None:
        return None
    cleaned = v.strip()
    if cleaned == "":
        return None
    if len(cleaned) > max_len:
        raise ValueError(f"must be at most {max_len} characters")
    return cleaned
