from fastapi.testclient import TestClient
from main import app  # Ensure 'main.py' is your API entry point

client = TestClient(app)

def test_create_task():
    response = client.post("/task", json={"text": "Test Task", "category": "actionable"})
    assert response.status_code == 200
    assert response.json()["task"]["text"] == "Test Task"

def test_get_task_history():
    response = client.get("/task-history")
    assert response.status_code == 200
