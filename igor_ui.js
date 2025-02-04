import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Brain, Volume2, ClipboardList, Play, Search, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// WebSocket connection management
const useWebSocket = (url) => {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(url);
      ws.current.onopen = () => setConnected(true);
      ws.current.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.current.onerror = () => setError('Connection lost. Click to retry.');
    };
    
    connect();
    return () => ws.current?.close();
  }, [url]);

  return { ws: ws.current, connected, error };
};

// Audio feedback system
const useAudio = () => {
  const speakText = useCallback((text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }, []);

  return { speakText };
};

const IgorUI = () => {
  const { ws, connected, error } = useWebSocket('ws://localhost:8000/ws');
  const { speakText } = useAudio();
  const [tasks, setTasks] = useState([]);
  const [knowledge, setKnowledge] = useState('');
  const [taskCategory, setTaskCategory] = useState("actionable");
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!ws) return;
    
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'task') {
        setTasks(prev => [...prev, data.task]);
      } else if (data.type === 'knowledge') {
        setKnowledge(data.content);
        speakText(data.content);
      }
    };
  }, [ws, speakText]);

  const executeTask = useCallback((task) => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: 'task_execute',
      task: task.text,
      category: task.category
    }));
    speakText(`Executing task: ${task.text}`);
  }, [ws, speakText]);

  const searchKnowledge = useCallback(() => {
    if (!ws || !searchQuery.trim()) return;
    ws.send(JSON.stringify({
      type: 'knowledge_search',
      query: searchQuery
    }));
  }, [ws, searchQuery]);

  return (
    <div className="p-6 space-y-6 bg-gradient-to-b from-green-50 to-blue-50">
      {error && (
        <Alert variant="destructive" role="alert" className="border-2">
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Search knowledge..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full p-2 border rounded"
            />
            <Button onClick={searchKnowledge} variant="outline">
              <Search className="h-5 w-5" /> Search
            </Button>
          </div>
          <div className="min-h-24 p-4 border rounded">
            {knowledge || 'No knowledge available.'}
          </div>
          {knowledge && (
            <Button 
              onClick={() => speakText(knowledge)} 
              className="mt-4 w-full"
              variant="outline"
            >
              <Volume2 className="h-5 w-5 mr-2" /> 
              Play Knowledge
            </Button>
          )}
        </CardContent>
      </Card>
      
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select 
            onChange={(e) => setTaskCategory(e.target.value)} 
            className="w-full p-2 mb-4 border rounded"
            value={taskCategory}
          >
            <option value="actionable">Active Tasks</option>
            <option value="research">Research Tasks</option>
            <option value="reminder">Future Tasks</option>
          </select>

          <div className="space-y-3">
            {tasks.map((task, i) => (
              <div 
                key={i}
                className="p-4 border-2 rounded flex items-center justify-between"
                role="listitem"
              >
                <span className="font-medium">{task.text}</span>
                <Button 
                  onClick={() => executeTask(task)}
                  variant="outline"
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-2" /> 
                  Execute
                </Button>
              </div>
            ))}
            {!tasks.length && (
              <div className="text-center p-4 border-2 border-dashed rounded">
                No tasks available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IgorUI;
