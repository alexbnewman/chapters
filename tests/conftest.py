import os
from pathlib import Path

# The tests know the fake history's numbers, so they must never see a real export in data/.
os.environ["CHAPTERS_DATA"] = str(Path(__file__).resolve().parents[1] / "data" / "sample")

import pytest  # noqa: E402

from chapters.eras import build  # noqa: E402


@pytest.fixture(scope="session")
def data():
    return build()
