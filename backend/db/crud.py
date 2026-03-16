"""CRUD helpers for Case and User models."""
from __future__ import annotations

import json
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Case, User
from models.schemas import PipelineResponse


async def create_case(db: AsyncSession, response: PipelineResponse, text: str) -> Case:
    case = Case(
        input_text=text,
        primary_diagnosis=response.primary_diagnosis,
        primary_icd10=response.primary_icd10,
        urgency=response.urgency,
        confidence=response.confidence,
        status=response.status,
        full_response_json=json.dumps(response.model_dump()),
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


async def get_cases(db: AsyncSession, limit: int = 20, offset: int = 0) -> List[Case]:
    result = await db.execute(
        select(Case).order_by(Case.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def get_case(db: AsyncSession, case_id: int) -> Optional[Case]:
    result = await db.execute(select(Case).where(Case.id == case_id))
    return result.scalar_one_or_none()


async def delete_case(db: AsyncSession, case_id: int) -> bool:
    case = await get_case(db, case_id)
    if not case:
        return False
    await db.delete(case)
    await db.commit()
    return True


async def create_user(db: AsyncSession, username: str, hashed_password: str) -> User:
    user = User(username=username, hashed_password=hashed_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()
