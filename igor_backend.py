 from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime
import asyncio
import requests
import faiss
import numpy as np
import redis
from redis import Redis
from enum import Enum
import json

app = FastAPI()

# Redis Connection
redis_client = Redis(host='localhost', port=6379, db=0, decode_responses=True)

def get_redis():
    try:
        yield redis_client
    finally:
        redis_client.close()

# Simulated database for tasks
tasks_db = []

# Simulated vector store for knowledge retrieval
dimension = 512
index = faiss.IndexFlatL2(dimension)
knowledge_db: Dict[int, str] = {}

# Task Router
class TaskType(Enum):
    CALENDAR = "calendar"
    NOTION = "notion"
    ZAPIER = "zapier"
    UNKNOWN = "unknown"

def route_task(task_text: str) -> TaskType:
    if "schedule" in task_text.lower():
        return TaskType.CALENDAR
    elif "note" in task_text.lower():
        return TaskType.NOTION
    elif "automation" in task_text.lower():
        return TaskType.ZAPIER
    return TaskType.UNKNOWN

# WebSocket Event Types
class WSEventType(Enum):
    TASK_CREATE = "task_create"
    TASK_EXECUTE = "task_execute"
    KNOWLEDGE_SEARCH = "knowledge_search"
    TASK_UPDATE = "task_update"
    ERROR = "error"

class TaskRequest(BaseModel):
    text: str
    category: str
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)

class KnowledgeSearchRequest(BaseModel):
    query: str

@app.post("/task")
def create_task(task: TaskRequest):
    task_entry = {
        "text": task.text,
        "category": task.category,
        "timestamp": task.timestamp.isoformat(),
        "status": "pending"
    }
    tasks_db.append(task_entry)
    redis_client.lpush("task_history", json.dumps(task_entry))
    return {"message": "Task added", "task": task_entry}

@app.get("/tasks")
def get_tasks():
    return {"tasks": tasks_db}

@app.get("/task-history")
def get_task_history():
    history = redis_client.lrange("task_history", 0, -1)
    return {"history": [json.loads(task) for task in history]}

@app.post("/execute-task")
def execute_task(task: TaskRequest):
    task_type = route_task(task.text)
    
    if task_type == TaskType.CALENDAR:
        response = requests.post("https://api.example.com/schedule-event", json={"task": task.text})
        return {"message": "Scheduled event", "status": response.status_code}
    elif task_type == TaskType.NOTION:
        response = requests.post("https://api.example.com/create-note", json={"task": task.text})
        return {"message": "Note created", "status": response.status_code}
    elif task_type == TaskType.ZAPIER:
        response = requests.post("https://api.example.com/trigger-automation", json={"task": task.text})
        return {"message": "Automation triggered", "status": response.status_code}
    elif task.category == "reminder":
        return {"message": "Reminder set for task"}
    return {"message": "Task received but not executed"}

@app.post("/search-knowledge")
def search_knowledge(request: KnowledgeSearchRequest):
    query_vector = np.random.rand(dimension).astype("float32")
    _, indices = index.search(np.array([query_vector]), 1)
    results = [knowledge_db.get(idx, "No relevant knowledge found") for idx in indices[0]]
    return {"results": results}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == WSEventType.KNOWLEDGE_SEARCH.value:
                results = search_knowledge(KnowledgeSearchRequest(query=data.get("query", "")))
                await websocket.send_json({"type": "knowledge", "content": results})
            elif data.get("type") == WSEventType.TASK_EXECUTE.value:
                result = execute_task(TaskRequest(text=data.get("task", ""), category=data.get("category", "")))
                await websocket.send_json({"type": "task_execution", "result": result})
    except WebSocketDisconnect:
        print("WebSocket disconnected")  
