from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import DATABASE_URL


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    processed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    model_version: Mapped[str | None] = mapped_column(String(120), nullable=True)
    threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    results: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    error: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    transactions: Mapped[list["TransactionRecord"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class TransactionRecord(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    timestamp: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    prediction: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    fraud_probability: Mapped[float] = mapped_column(Float, nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    review_status: Mapped[str] = mapped_column(String(30), nullable=False, default="unreviewed")
    model_version: Mapped[str] = mapped_column(String(120), nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    analysis_job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    label: Mapped[int | None] = mapped_column(Integer, nullable=True)
    explanation: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    features: Mapped[dict[str, float] | None] = mapped_column(JSON, nullable=True)

    job: Mapped[AnalysisJob] = relationship(back_populates="transactions")


class Database:
    def __init__(self, url: str = DATABASE_URL):
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgres://")
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgresql://")

        connect_args: dict[str, Any] = {}
        engine_options: dict[str, Any] = {"future": True, "pool_pre_ping": True}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
            # An in-memory SQLite database must share one connection across
            # FastAPI/Starlette worker threads during API tests.
            if url in {"sqlite://", "sqlite:///:memory:"}:
                engine_options["poolclass"] = StaticPool
        if url.startswith("postgresql+"):
            connect_args["sslmode"] = "require"

        self.engine = create_engine(url, connect_args=connect_args, **engine_options)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False, expire_on_commit=False)

    def initialize(self) -> None:
        Base.metadata.create_all(self.engine)

    def check(self) -> bool:
        with self.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True


_db: Database | None = None


def get_database() -> Database:
    global _db
    if _db is None:
        _db = Database()
    return _db


def reset_database_for_tests(url: str = "sqlite://") -> Database:
    global _db
    if _db is not None:
        _db.engine.dispose()
    _db = Database(url)
    _db.initialize()
    return _db
