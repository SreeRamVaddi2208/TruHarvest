"""Odoo XML-RPC client with thread-safe connections, retry logic, and error handling."""

import threading
import xmlrpc.client
from typing import Any, Dict, List, Optional

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import get_settings
from app.core.exceptions import OdooAuthenticationError, OdooConnectionError, OdooOperationError
from app.core.logging import get_logger

logger = get_logger(__name__)


def _odoo_falsy_to_none(value: Any) -> Any:
    """Convert Odoo's False/0 placeholders to None for optional fields."""
    if value is False or value is None:
        return None
    return value


class OdooClient:
    """Thread-safe Odoo XML-RPC client.

    Creates fresh ServerProxy connections per-thread to avoid
    the 'Request-sent' / 'Idle' errors from concurrent reuse
    of a single HTTP connection.
    """

    _instance: Optional["OdooClient"] = None
    _initialized: bool = False

    def __new__(cls) -> "OdooClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        settings = get_settings()
        self.url = settings.ODOO_URL
        self.db = settings.ODOO_DB
        self.username = settings.ODOO_USERNAME
        self.password = settings.ODOO_PASSWORD
        self.uid: Optional[int] = None
        self._auth_lock = threading.Lock()
        self._local = threading.local()
        self._initialized = True

    def _get_common(self) -> xmlrpc.client.ServerProxy:
        """Get a thread-local common proxy (creates one if needed)."""
        proxy = getattr(self._local, "common", None)
        if proxy is None:
            try:
                proxy = xmlrpc.client.ServerProxy(
                    f"{self.url}/xmlrpc/2/common",
                    allow_none=True,
                )
                self._local.common = proxy
            except Exception as e:
                logger.error("Failed to create common proxy", error=str(e))
                raise OdooConnectionError(
                    message=f"Cannot connect to Odoo at {self.url}",
                    details={"url": self.url, "error": str(e)},
                )
        return proxy

    def _get_models(self) -> xmlrpc.client.ServerProxy:
        """Get a thread-local models proxy (creates one if needed)."""
        proxy = getattr(self._local, "models", None)
        if proxy is None:
            try:
                proxy = xmlrpc.client.ServerProxy(
                    f"{self.url}/xmlrpc/2/object",
                    allow_none=True,
                )
                self._local.models = proxy
            except Exception as e:
                logger.error("Failed to create models proxy", error=str(e))
                raise OdooConnectionError(
                    message=f"Cannot connect to Odoo models at {self.url}",
                    details={"url": self.url, "error": str(e)},
                )
        return proxy

    def _clear_thread_proxies(self) -> None:
        """Clear thread-local proxies (forces reconnect on next call)."""
        self._local.common = None
        self._local.models = None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        reraise=True,
    )
    def authenticate(self) -> int:
        """Authenticate with Odoo and return user ID (thread-safe)."""
        with self._auth_lock:
            if self.uid is not None:
                return self.uid

            try:
                logger.info("Authenticating with Odoo", url=self.url, db=self.db, user=self.username)
                common = self._get_common()
                uid = common.authenticate(self.db, self.username, self.password, {})

                if not uid:
                    raise OdooAuthenticationError(
                        message="Invalid Odoo credentials",
                        details={"url": self.url, "db": self.db, "username": self.username},
                    )

                self.uid = uid
                logger.info("Odoo authentication successful", uid=uid)
                return uid

            except OdooAuthenticationError:
                raise
            except xmlrpc.client.Fault as e:
                logger.error("Odoo XML-RPC fault during auth", error=str(e))
                raise OdooAuthenticationError(
                    message=f"Odoo authentication error: {e.faultString}",
                    details={"fault_code": e.faultCode, "fault_string": e.faultString},
                )
            except (ConnectionError, TimeoutError, OSError):
                self._clear_thread_proxies()
                raise
            except Exception as e:
                logger.error("Odoo connection error during auth", error=str(e))
                self._clear_thread_proxies()
                raise OdooConnectionError(
                    message=f"Cannot connect to Odoo: {str(e)}",
                    details={"url": self.url, "error": str(e)},
                )

    def ensure_authenticated(self) -> int:
        """Ensure the client is authenticated, re-authenticate if needed."""
        if self.uid is None:
            return self.authenticate()
        return self.uid

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        reraise=True,
    )
    def execute_kw(
        self,
        model: str,
        method: str,
        args: List[Any],
        kwargs: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Execute a method on an Odoo model with retry logic (thread-safe)."""
        uid = self.ensure_authenticated()
        kwargs = kwargs or {}

        try:
            logger.debug(
                "Executing Odoo operation",
                model=model,
                method=method,
                args_count=len(args),
            )

            models_proxy = self._get_models()
            result = models_proxy.execute_kw(
                self.db, uid, self.password,
                model, method, args, kwargs,
            )

            logger.debug(
                "Odoo operation successful",
                model=model,
                method=method,
                result_type=type(result).__name__,
            )

            return result

        except xmlrpc.client.Fault as e:
            logger.error(
                "Odoo XML-RPC fault",
                model=model,
                method=method,
                fault_code=e.faultCode,
                fault_string=e.faultString,
            )
            if "AccessDenied" in str(e.faultString) or "Session expired" in str(e.faultString):
                self.uid = None
                self._clear_thread_proxies()
                raise OdooAuthenticationError(
                    message="Odoo session expired, please retry",
                    details={"fault": e.faultString},
                )

            raise OdooOperationError(
                message=f"Odoo operation failed: {e.faultString}",
                details={
                    "model": model,
                    "method": method,
                    "fault_code": e.faultCode,
                    "fault_string": e.faultString,
                },
            )
        except (ConnectionError, TimeoutError, OSError) as e:
            logger.error("Odoo connection error", model=model, method=method, error=str(e))
            self._clear_thread_proxies()
            raise
        except Exception as e:
            logger.error("Unexpected Odoo error", model=model, method=method, error=str(e))
            self._clear_thread_proxies()
            raise OdooOperationError(
                message=f"Unexpected error during Odoo operation: {str(e)}",
                details={"model": model, "method": method, "error": str(e)},
            )

    # --- Convenience Methods ---

    def search(
        self,
        model: str,
        domain: List[Any],
        offset: int = 0,
        limit: Optional[int] = None,
        order: Optional[str] = None,
    ) -> List[int]:
        """Search for record IDs matching the domain."""
        kwargs: Dict[str, Any] = {"offset": offset}
        if limit is not None:
            kwargs["limit"] = limit
        if order is not None:
            kwargs["order"] = order
        return self.execute_kw(model, "search", [domain], kwargs)

    def search_read(
        self,
        model: str,
        domain: List[Any],
        fields: Optional[List[str]] = None,
        offset: int = 0,
        limit: Optional[int] = None,
        order: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search and read records in one call."""
        kwargs: Dict[str, Any] = {"offset": offset}
        if fields is not None:
            kwargs["fields"] = fields
        if limit is not None:
            kwargs["limit"] = limit
        if order is not None:
            kwargs["order"] = order
        return self.execute_kw(model, "search_read", [domain], kwargs)

    def read(
        self,
        model: str,
        ids: List[int],
        fields: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Read specific records by ID."""
        kwargs = {}
        if fields is not None:
            kwargs["fields"] = fields
        return self.execute_kw(model, "read", [ids], kwargs)

    def create(self, model: str, values: Dict[str, Any]) -> int:
        """Create a new record."""
        return self.execute_kw(model, "create", [values])

    def write(self, model: str, ids: List[int], values: Dict[str, Any]) -> bool:
        """Update existing records."""
        return self.execute_kw(model, "write", [ids, values])

    def unlink(self, model: str, ids: List[int]) -> bool:
        """Delete records."""
        return self.execute_kw(model, "unlink", [ids])

    def search_count(self, model: str, domain: List[Any]) -> int:
        """Count records matching the domain."""
        return self.execute_kw(model, "search_count", [domain])

    def fields_get(
        self,
        model: str,
        attributes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Get field definitions for a model."""
        attributes = attributes or ["string", "help", "type"]
        return self.execute_kw(model, "fields_get", [], {"attributes": attributes})

    def check_connection(self) -> Dict[str, Any]:
        """Test the Odoo connection and return server info."""
        try:
            common = self._get_common()
            version = common.version()
            uid = self.ensure_authenticated()
            return {
                "connected": True,
                "server_version": version.get("server_version", "unknown"),
                "server_serie": version.get("server_serie", "unknown"),
                "uid": uid,
                "url": self.url,
                "db": self.db,
            }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e),
                "url": self.url,
                "db": self.db,
            }

    def reset(self) -> None:
        """Reset the client state (useful for reconnection)."""
        self.uid = None
        self._clear_thread_proxies()


def get_odoo_client() -> OdooClient:
    """Get the singleton Odoo client instance."""
    return OdooClient()
