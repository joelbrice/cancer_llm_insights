"""
User management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.v1.deps import require_auth
from app.models.user import User
from app.schemas.auth import UserResponse, UserUpdate

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
    tags=["users"],
)
async def get_me(current_user: User = Depends(require_auth)):
    return current_user


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile",
    tags=["users"],
)
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.preferred_language is not None:
        current_user.preferred_language = body.preferred_language
    if body.password is not None:
        current_user.hashed_password = get_password_hash(body.password)

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete current user account",
    tags=["users"],
)
async def delete_me(
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    current_user.is_active = False
    await db.commit()
