import os
import json
from typing import Any
from fastapi import HTTPException, status
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError

def _get_container_client():
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    container = os.getenv("AZURE_PROCESSED_CONTAINER", "processed")

    if not conn_str:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure storage connection string not configured",
        )

    bsc = BlobServiceClient.from_connection_string(conn_str)
    return bsc.get_container_client(container)

def read_latest_device_json(device_id: str) -> Any:
    """
    Reads processed/latest/<device_id>.json and returns parsed JSON.
    Expects a single valid JSON document.
    """
    prefix = os.getenv("AZURE_LATEST_PREFIX", "latest").strip("/")
    blob_name = f"{prefix}/{device_id}.json"

    container_client = _get_container_client()
    blob_client = container_client.get_blob_client(blob_name)

    try:
        raw = blob_client.download_blob().readall()
    except ResourceNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Blob not found: {blob_name}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Blob read failed: {blob_name}. {str(e)}")

    text = raw.decode("utf-8", errors="replace").lstrip("\ufeff").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        # If you still have any old NDJSON blobs around, this message will help.
        preview = text[:200]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid JSON in blob: {blob_name}. Error: {str(e)}. Preview: {preview}",
        )

def list_latest_devices() -> list[str]:
    """
    Lists device IDs available under processed/latest/*.json
    Returns ["device-S-101", "device-S-102", ...]
    """
    prefix = os.getenv("AZURE_LATEST_PREFIX", "latest").strip("/") + "/"
    container_client = _get_container_client()

    device_ids: list[str] = []
    for blob in container_client.list_blobs(name_starts_with=prefix):
        name = blob.name  # e.g. "latest/device-S-102.json"
        if not name.endswith(".json"):
            continue
        base = name[len(prefix):]  # "device-S-102.json"
        device_id = base[:-5]      # strip ".json"
        device_ids.append(device_id)

    device_ids.sort()
    return device_ids
