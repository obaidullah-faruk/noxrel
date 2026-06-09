import secrets
import uuid
from typing import Annotated

import jwt
import structlog
from fastapi import Depends, Header, HTTPException, status

from app.core.config import settings

logger = structlog.get_logger(__name__)


class GatewayUser:
    """Authenticated caller.

    Identity comes from a verified RS256 JWT (the `Authorization: Bearer` token
    issued by user-service). billing-service is a downstream verifier — it only
    validates with the public key and never issues tokens.
    """

    def __init__(self, user_id: str, roles: list[str]) -> None:
        self.id = uuid.UUID(user_id)
        self.roles = roles

    def has_role(self, *roles: str) -> bool:
        return bool(set(roles) & set(self.roles))


def _user_from_bearer(authorization: str) -> GatewayUser:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        claims = jwt.decode(token, settings.jwt_verifying_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        logger.warning("jwt_verification_failed", error=str(exc))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    user_id = claims.get("sub") or claims.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject claim")
    return GatewayUser(str(user_id), claims.get("roles", []))


def _user_from_gateway_headers(
    x_user_id: str,
    x_user_roles: str | None,
    x_gateway_secret: str | None,
) -> GatewayUser:
    # Only trust gateway headers when the caller proves it is the internal
    # gateway by supplying the shared secret. Constant-time comparison prevents
    # timing-based enumeration of the secret value.
    shared_secret = settings.gateway_shared_secret
    if not shared_secret or not x_gateway_secret or not secrets.compare_digest(shared_secret, x_gateway_secret):
        logger.warning("gateway_secret_mismatch")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        uuid.UUID(x_user_id)
    except ValueError:
        logger.warning("invalid_user_id_header", user_id=x_user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identity")
    roles = [r.strip() for r in (x_user_roles or "").split(",") if r.strip()]
    return GatewayUser(x_user_id, roles)


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header()] = None,
    x_user_roles: Annotated[str | None, Header()] = None,
    x_gateway_secret: Annotated[str | None, Header()] = None,
) -> GatewayUser:
    if authorization:
        return _user_from_bearer(authorization)
    if x_user_id:
        return _user_from_gateway_headers(x_user_id, x_user_roles, x_gateway_secret)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


async def require_billing_admin(user: Annotated[GatewayUser, Depends(get_current_user)]) -> GatewayUser:
    if not user.has_role("admin", "superadmin", "billing_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user


CurrentUser = Annotated[GatewayUser, Depends(get_current_user)]
BillingAdmin = Annotated[GatewayUser, Depends(require_billing_admin)]
