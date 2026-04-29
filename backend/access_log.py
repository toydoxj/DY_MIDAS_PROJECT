"""DY_MIDAS 자체 access log — 본 앱(Electron sidecar) 진입 시 사용자/세션을 기록.

- task.dyce.kr SSO 통과 후 frontend가 /api/admin/track-login을 호출하면 INSERT.
- sid(JWT의 세션 ID) UNIQUE → 같은 세션 재요청은 무시.
- 조회는 admin만 (라우터 측에서 require_admin).

DB 위치: BACKEND_DATA_DIR(Electron이 app.getPath('userData') 전달) 우선,
없으면 현재 작업 디렉토리. PyInstaller frozen + Electron packaged 모두 안전.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager
from typing import Iterable, Optional

_DB_LOCK = threading.Lock()
_DB_FILENAME = "access_log.db"


def _data_dir() -> str:
    base = os.environ.get("BACKEND_DATA_DIR") or os.getcwd()
    os.makedirs(base, exist_ok=True)
    return base


def _db_path() -> str:
    return os.path.join(_data_dir(), _DB_FILENAME)


@contextmanager
def _conn():
    """thread-safe sqlite 연결 — WAL + busy timeout."""
    with _DB_LOCK:
        c = sqlite3.connect(_db_path(), timeout=10, isolation_level=None)
        try:
            c.execute("PRAGMA journal_mode=WAL")
            c.execute("PRAGMA busy_timeout=5000")
            c.row_factory = sqlite3.Row
            yield c
        finally:
            c.close()


_SCHEMA = """
CREATE TABLE IF NOT EXISTS access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    name TEXT,
    email TEXT,
    role TEXT,
    sid TEXT,
    ip TEXT,
    user_agent TEXT,
    app_version TEXT,
    ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_access_log_user_id ON access_log(user_id);
CREATE INDEX IF NOT EXISTS ix_access_log_ts ON access_log(ts);
CREATE UNIQUE INDEX IF NOT EXISTS ux_access_log_sid ON access_log(sid)
    WHERE sid IS NOT NULL AND sid != '';
"""


def init_db() -> None:
    with _conn() as c:
        c.executescript(_SCHEMA)


def insert_event(
    *,
    user_id: int,
    username: str,
    name: str,
    email: str,
    role: str,
    sid: Optional[str],
    ip: Optional[str],
    user_agent: Optional[str],
    app_version: Optional[str],
    ts: str,
) -> bool:
    """INSERT — sid UNIQUE 충돌 시 무시(False 반환). 신규 INSERT 시 True."""
    init_db()
    try:
        with _conn() as c:
            c.execute(
                """
                INSERT INTO access_log
                    (user_id, username, name, email, role, sid, ip, user_agent, app_version, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id, username, name, email, role,
                    sid or None, ip, user_agent, app_version, ts,
                ),
            )
        return True
    except sqlite3.IntegrityError:
        # sid 중복 — 같은 세션 재요청. 정상 동작.
        return False


def list_users_summary() -> list[dict]:
    """사용자별 요약 — 마지막 접속, 누적 접속 수."""
    init_db()
    with _conn() as c:
        rows: Iterable[sqlite3.Row] = c.execute(
            """
            SELECT
                user_id,
                MAX(username) AS username,
                MAX(name) AS name,
                MAX(email) AS email,
                MAX(role) AS role,
                MAX(ts) AS last_seen,
                COUNT(*) AS total_logins
            FROM access_log
            GROUP BY user_id
            ORDER BY last_seen DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


def list_recent(limit: int = 200) -> list[dict]:
    """최근 접속 이벤트 시간순(desc)."""
    init_db()
    limit = max(1, min(int(limit), 1000))
    with _conn() as c:
        rows = c.execute(
            """
            SELECT id, user_id, username, name, email, role, sid,
                   ip, user_agent, app_version, ts
            FROM access_log
            ORDER BY ts DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]
