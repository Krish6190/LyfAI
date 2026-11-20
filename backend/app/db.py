import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def connect(database_path: str) -> sqlite3.Connection:
    # Create the database directory before opening SQLite.
    path = Path(database_path)
    if path.parent != Path("."):
        path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize(database_path: str) -> None:
    # Create the message table automatically on startup.
    with connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id)"
        )


def get_messages(database_path: str, session_id: str) -> list[dict]:
    # Load the previous history so the model can remember this session.
    with connect(database_path) as connection:
        rows = connection.execute(
            "SELECT role, content, metadata FROM messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
    return [
        {
            "role": row["role"],
            "content": row["content"],
            **(
                {"metadata": json.loads(row["metadata"])}
                if row["metadata"]
                else {}
            ),
        }
        for row in rows
    ]


def add_message(
    database_path: str,
    session_id: str,
    role: str,
    content: str,
    metadata: dict | None = None,
) -> None:
    # Store every successful user or assistant message in SQLite.
    with connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO messages(session_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                session_id,
                role,
                content,
                json.dumps(metadata) if metadata else None,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
