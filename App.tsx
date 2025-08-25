import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Message } from './types';
import { MessageRole } from './types';
import { sendMessageToGemini, searchWithGemini, generateImageWithGemini } from './services/geminiService';
import MessageComponent from './components/Message';
import { SendIcon, MicrophoneIcon } from './components/Icons';

// --- Type definitions for Web Speech API ---
// These are not included in standard TypeScript DOM library types
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}
// --- End of type definitions ---

// Polyfill for SpeechRecognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: MessageRole.MODEL,
      text: "Hello! I'm Sahaya, your bilingual AI assistant. How can I help you today? You can ask me to search, generate images, or just chat.",
    }
  ]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('Online');
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const sinhalaVoice = voices.find(voice => voice.lang === 'si-LK');
      
      if (sinhalaVoice) {
        utterance.voice = sinhalaVoice;
      }
      utterance.lang = 'si-LK';
      
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: MessageRole.USER, text };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    let modelResponse: Omit<Message, 'id' | 'role'> | null = null;
    
    // Command parsing
    const imageMatch = text.match(/^(?:generate|create|make) an? image of (.+)/i);
    const openMatch = text.match(/^open (.+)/i);
    const timeMatch = text.match(/what time is it|date and time/i);
    const searchMatch = text.match(/^(what is|who is|latest news about|search for)/i);

    if (imageMatch) {
      setStatus(`Generating image: ${imageMatch[1]}`);
      const imageUrl = await generateImageWithGemini(imageMatch[1]);
      if (imageUrl) {
        modelResponse = { text: `Here is an image of ${imageMatch[1]}`, imageUrl: imageUrl };
      } else {
        modelResponse = { text: "I'm sorry, I couldn't generate the image." };
      }
    } else if (openMatch) {
        let url = openMatch[1].trim();
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }
        window.open(url, '_blank');
        modelResponse = { text: `Opening ${openMatch[1]}...` };
        setMessages(prev => [...prev, {
            id: Date.now().toString() + '-sys',
            role: MessageRole.SYSTEM,
            text: `Navigating to ${url}`
        }]);

    } else if (timeMatch) {
      const now = new Date();
      const responseText = `The current date and time is: ${now.toLocaleString()}`;
      modelResponse = { text: responseText };
    } else if (searchMatch) {
      setStatus(`Searching for: ${text}`);
      const { text: responseText, results } = await searchWithGemini(text);
      modelResponse = { text: responseText, searchResults: results };
    } else {
      setStatus('Thinking...');
      const responseText = await sendMessageToGemini(text);
      modelResponse = { text: responseText };
    }
    
    if (modelResponse) {
        const finalModelMessage: Message = { 
            id: Date.now().toString() + '-model',
            role: MessageRole.MODEL,
            ...modelResponse
        };
        setMessages(prev => [...prev, finalModelMessage]);
        if (finalModelMessage.text) {
          speak(finalModelMessage.text);
        }
    }

    setIsLoading(false);
    setStatus('Online');
  }, [speak]);

  const handleListen = useCallback(() => {
    if (!SpeechRecognition) {
      setStatus('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'si-LK';
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setStatus('Listening...');
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserInput(transcript);
      handleSendMessage(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setStatus(`Error: ${event.error}`);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      setStatus('Online');
    };
    
    recognitionRef.current.start();
  }, [isListening, handleSendMessage]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
      <header className="p-4 border-b border-gray-700 shadow-md bg-gray-800">
        <h1 className="text-xl font-bold text-center">Bilingual AI Assistant (Sahaya)</h1>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {messages.map(msg => <MessageComponent key={msg.id} message={msg} />)}
          {isLoading && <MessageComponent message={{ id: 'loading', role: MessageRole.MODEL, text: '...' }} />}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(userInput);
            }}
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message or press the mic to talk..."
              className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={handleListen}
              className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'} disabled:opacity-50`}
              disabled={isLoading}
            >
              <MicrophoneIcon className="w-6 h-6 text-white" />
            </button>
            <button
              type="submit"
              className="p-3 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:bg-blue-800"
              disabled={isLoading || !userInput.trim()}
            >
              <SendIcon className="w-6 h-6 text-white" />
            </button>
          </form>
          <div className="text-center text-sm text-gray-400 pt-2">{status}</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
