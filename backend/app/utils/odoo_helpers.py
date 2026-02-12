"""Utility helpers for working with Odoo data.

Odoo XML-RPC returns False (Python bool) for empty/null fields
instead of None. This module provides sanitizers to clean the data
before passing it to Pydantic models.
"""

from typing import Any, Dict


def clean_odoo_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize an Odoo record by converting all False values to None.

    Odoo uses False as a sentinel for empty/unset fields across ALL types:
    - Empty string fields → False
    - Empty Many2one fields → False
    - Empty date fields → False
    - Empty numeric fields → False (but 0 is also valid!)

    This function converts every False to None so Pydantic Optional[T]
    fields work correctly.
    """
    cleaned = {}
    for key, value in record.items():
        if value is False:
            cleaned[key] = None
        else:
            cleaned[key] = value
    return cleaned


def odoo_str(value: Any) -> str | None:
    """Convert an Odoo value to str or None."""
    if value is False or value is None:
        return None
    return str(value)


def odoo_float(value: Any, default: float = 0.0) -> float:
    """Convert an Odoo value to float."""
    if value is False or value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def odoo_int(value: Any, default: int = 0) -> int:
    """Convert an Odoo value to int."""
    if value is False or value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def odoo_m2o_id(value: Any) -> int | None:
    """Extract the ID from an Odoo Many2one field [id, name] or return None."""
    if isinstance(value, (list, tuple)) and len(value) >= 1:
        return value[0]
    if isinstance(value, int) and value:
        return value
    return None


def odoo_m2o_name(value: Any) -> str | None:
    """Extract the display name from an Odoo Many2one field [id, name] or return None."""
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return str(value[1])
    return None
