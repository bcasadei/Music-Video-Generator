from sqlmodel import SQLModel, Field, Session, create_engine
from datetime import datetime
from uuid import uuid4
import os

DB_PATH = os.getenv("DB_PATH", "data/musicvid.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)


class Character(SQLModel, table=True):
    id:               str      = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name:             str
    lora_name:        str
    trigger_word:     str
    default_strength: float    = 0.75
    preview_path:     str      = ""
    created_at:       datetime = Field(default_factory=datetime.utcnow)


def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
