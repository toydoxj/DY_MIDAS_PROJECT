"""MIDAS API 커스텀 예외 클래스 계층 구조

에러 응답 포맷:
    {
        "error_code": "API_ERROR",
        "message": "사람이 읽을 수 있는 메시지"
    }
"""


class MidasError(Exception):
    """MIDAS 기본 예외 클래스 — 모든 커스텀 예외의 부모"""

    error_code: str = "MIDAS_ERROR"
    status_code: int = 500

    def __init__(self, message: str = "MIDAS 오류가 발생했습니다"):
        self.message = message
        super().__init__(message)


class MidasApiError(MidasError):
    """MIDAS API 호출 실패 (네트워크 오류, 서버 오류 등)"""

    error_code = "API_ERROR"
    status_code = 502

    def __init__(
        self,
        message: str = "MIDAS API 호출에 실패했습니다",
        *,
        cause: str = "",
    ):
        self.cause = cause
        super().__init__(message)


class MidasConnectionError(MidasError):
    """MIDAS API URL 또는 키가 설정되지 않았거나 잘못된 경우"""

    error_code = "CONNECTION_ERROR"
    status_code = 503

    def __init__(self, message: str = "MIDAS 연결 설정이 올바르지 않습니다"):
        super().__init__(message)


class MidasValidationError(MidasError):
    """입력 데이터 검증 실패"""

    error_code = "VALIDATION_ERROR"
    status_code = 422

    def __init__(self, message: str = "입력 데이터가 올바르지 않습니다"):
        super().__init__(message)


class MidasNotFoundError(MidasError):
    """요청한 리소스를 찾을 수 없음"""

    error_code = "NOT_FOUND"
    status_code = 404

    def __init__(self, message: str = "리소스를 찾을 수 없습니다"):
        super().__init__(message)


class MidasAuthExpiredError(MidasError):
    """MIDAS GEN 세션 미연결 — 401(키 무효) 또는 404(세션/지역 불일치).

    구분:
        401: MAPI-Key 자체가 무효 (오타/잘못된 값)
        404: MIDAS GEN의 Apps > Connect가 끊겼거나 Base URL의 지역 서버가
             GEN과 다름 (예: 한국 GEN 키를 글로벌 URL로 호출)
    """

    error_code = "AUTH_EXPIRED"
    status_code = 401

    def __init__(
        self,
        message: str = (
            "MIDAS GEN 세션을 찾지 못했습니다. [설정] 페이지에서 "
            "MAPI-Key를 갱신하거나 [지역 자동 감지]를 시도하세요."
        ),
    ):
        super().__init__(message)
