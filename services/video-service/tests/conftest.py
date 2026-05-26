import uuid

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_id():
    return str(uuid.uuid4())


@pytest.fixture
def authed_client(api_client, user_id):
    """API client with gateway headers simulating an authenticated user."""
    api_client.credentials(
        HTTP_X_USER_ID=user_id,
        HTTP_X_USER_PERMISSIONS="video:upload,video:watch,video:publish,video:delete",
        HTTP_X_USER_ROLES="admin",
    )
    return api_client, user_id
