from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import db
from ..auth import User, current_user, require_writer
from ..contracts import Collection

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("", response_model=list[Collection])
def list_collections(user: User = Depends(current_user)):
    return db.fetch_all(
        """select id::text, name, owner::text from public.collections c
           where public.can_read_collection(c.id, %s::uuid) order by name""",
        (user.id,),
    )


class NewCollection(BaseModel):
    name: str = Field(min_length=1, max_length=80)


@router.post("", response_model=Collection, status_code=201)
def create_collection(body: NewCollection, user: User = Depends(require_writer)):
    return db.fetch_one(
        "insert into public.collections (owner, name) values (%s, %s) returning id::text, name, owner::text",
        (user.id, body.name.strip()),
    )
