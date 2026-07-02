import io
from urllib.parse import quote

import httpx

from config import settings


def _encode_path(path: str) -> str:
    return quote(path, safe="/")


def _storage_headers(content_type: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def build_storage_public_url(bucket: str, path: str) -> str:
    safe_path = _encode_path(path)
    return f"{settings.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/{bucket}/{safe_path}"


def build_storage_object_url(bucket: str, path: str) -> str:
    safe_path = _encode_path(path)
    return f"{settings.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/{bucket}/{safe_path}"


def upload_to_supabase(bucket: str, path: str, content: bytes, content_type: str = "application/octet-stream") -> None:
    url = build_storage_object_url(bucket, path)
    response = httpx.put(url, content=content, headers=_storage_headers(content_type), timeout=120)
    response.raise_for_status()


def delete_from_supabase(bucket: str, path: str) -> None:
    url = build_storage_object_url(bucket, path)
    response = httpx.delete(url, headers=_storage_headers(), timeout=60)
    response.raise_for_status()


def download_from_supabase(bucket: str, path: str) -> httpx.Response:
    url = build_storage_object_url(bucket, path)
    response = httpx.get(url, headers=_storage_headers(), timeout=120)
    response.raise_for_status()
    return response


def stream_from_supabase(bucket: str, path: str):
    response = download_from_supabase(bucket, path)
    return io.BytesIO(response.content)