from rest_framework.request import Request

from ..auth import get_request_user


def require_admin(request: Request):
    user = get_request_user(request)
    if user is None or not user.is_superuser:
        return None
    return user
