
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, User } from './types';
import { MessageRole } from './types';
import { getAssistantResponse } from './services/geminiService';
import MessageComponent from './components/Message';
import { SendIcon, MicrophoneIcon, LogoutIcon, SpeakerOnIcon, SpeakerOffIcon } from './components/Icons';
import Auth from './components/Auth';

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('සබැඳි ඇත');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState<boolean>(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsWarningShown, setTtsWarningShown] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Check for logged-in user on component mount
  useEffect(() => {
    const loggedInUserJson = localStorage.getItem('currentUser');
    if (loggedInUserJson) {
      try {
        const user = JSON.parse(loggedInUserJson);
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  // Set initial message when user logs in
  useEffect(() => {
    if (currentUser) {
      setMessages([
        {
          id: 'init',
          role: MessageRole.MODEL,
          text: `ආයුබෝවන් ${currentUser.username}! මම මදු, ඔබේ AI සහායක. අද මම ඔබට උදව් කළ හැක්කේ කෙසේද?`,
        }
      ]);
    }
  }, [currentUser]);
  
  // Load speech synthesis voices
  useEffect(() => {
    const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
        window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speak = useCallback((text: string) => {
    if (!isSpeakingEnabled || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = 'si-LK';
    
    let selectedVoice = voices.find(voice => voice.lang === targetLang);
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => voice.lang.startsWith('si'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = targetLang;
      window.speechSynthesis.speak(utterance);
    } else if (!ttsWarningShown) {
        const warningMessage: Message = {
            id: 'tts-warning',
            role: MessageRole.SYSTEM,
            text: "කථන ප්‍රතිදානය සඳහා සිංහල භාෂා පැකේජයක් ඔබගේ උපාංගයේ ස්ථාපනය කර නොමැති බව පෙනේ. පිළිතුරු පෙළ ලෙස දිස්වනු ඇත."
        };
        setMessages(prev => [...prev, warningMessage]);
        setTtsWarningShown(true);
    }
  }, [voices, isSpeakingEnabled, ttsWarningShown]);
  
  const handleLogin = (user: User) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setMessages([]); // Clear messages on logout
  };

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: MessageRole.USER, text };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setStatus('සිතමින්...');

    const history = messages
      .filter(m => (m.role === MessageRole.USER || m.role === MessageRole.MODEL) && m.text)
      .map(m => ({
        role: m.role,
        parts: [{ text: m.text! }],
      }));

    try {
        // @ts-ignore
        const response = await getAssistantResponse(text, history);

        const finalModelMessage: Message = { 
            id: Date.now().toString() + '-model',
            role: MessageRole.MODEL,
            text: response.text,
            imageUrl: response.imageUrl,
            searchResults: response.searchResults,
        };

        setMessages(prev => [...prev, finalModelMessage]);
        if (finalModelMessage.text) {
          speak(finalModelMessage.text);
        }

    } catch (error) {
        console.error("Error with assistant:", error);
        const errorMessage: Message = {
            id: Date.now().toString() + '-model',
            role: MessageRole.MODEL,
            text: "මට කණගාටුයි, දෝෂයක් ඇතිවිය. කරුණාකර නැවත උත්සාහ කරන්න."
        };
        setMessages(prev => [...prev, errorMessage]);
        if (errorMessage.text) {
            speak(errorMessage.text);
        }
    } finally {
        setIsLoading(false);
        setStatus('සබැඳි ඇත');
    }
  }, [messages, speak]);
  
  // Effect to manage the speech recognition lifecycle for "press-to-talk"
  useEffect(() => {
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    // If not listening, ensure any existing recognition is stopped.
    if (!isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }
    
    // Start a new recognition session
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'si-LK';
    recognition.continuous = false; // Stop after first utterance
    recognition.interimResults = false; // Only final results

    recognition.onstart = () => {
      setStatus('මම අහගෙන ඉන්නේ...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
         setStatus(`ඇසුණි: "${transcript}"`);
         handleSendMessage(transcript);
      }
      setIsListening(false); // Turn off listening after getting a result
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error, event.message);
      let errorMessage = '';
      switch (event.error) {
        case 'no-speech':
          errorMessage = "කථනයක් හඳුනා නොගත්තේය. නැවත උත්සාහ කරන්න...";
          break;
        case 'network':
          errorMessage = "ජාල දෝෂයක්. කරුණාකර ඔබගේ සම්බන්ධතාවය පරීක්ෂා කර නැවත උත්සාහ කරන්න.";
          break;
        case 'audio-capture':
          errorMessage = "මයික්‍රෆෝනයෙන් ශ්‍රව්‍ය ග්‍රහණය කර ගැනීමට නොහැකි විය.";
          break;
        case 'not-allowed':
          errorMessage = "මයික්‍රෆෝන ප්‍රවේශය ප්‍රතික්ෂේප විය.";
          break;
        default:
          errorMessage = "කථනය හඳුනාගැනීමේ දෝෂයක් ඇතිවිය.";
          break;
      }
      setStatus(errorMessage);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) { // If it ends prematurely
        setIsListening(false);
      }
      // Don't update status here if loading, as handleSendMessage will manage it.
      if (!isLoading) {
         setStatus('සබැඳි ඇත');
      }
    };
    
    recognition.start();
    
    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isListening, handleSendMessage, isLoading]);

  const handleListenToggle = () => {
    if (isLoading) return;
    setIsListening(prev => !prev);
  };

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
      <header className="p-4 border-b border-gray-700 shadow-md bg-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold">AI සහායක (මදු)</h1>
        <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300 hidden sm:inline">ආයුබෝවන්, {currentUser.username}!</span>
            <button
                onClick={handleLogout}
                className="p-2 rounded-full transition-colors bg-gray-700 hover:bg-red-500"
                aria-label="Logout"
            >
                <LogoutIcon className="w-5 h-5 text-white" />
            </button>
        </div>
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
              placeholder='ඔබේ පණිවිඩය ටයිප් කරන්න නැතහොත් කතා කිරීමට මයික්‍රෆෝනය ඔබන්න...'
              className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={handleListenToggle}
              className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'} disabled:opacity-50`}
              disabled={isLoading}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              <MicrophoneIcon className="w-6 h-6 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setIsSpeakingEnabled(prev => !prev)}
              className={`p-3 rounded-full transition-colors ${isSpeakingEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'} disabled:opacity-50`}
              disabled={isLoading}
              aria-label={isSpeakingEnabled ? 'Disable voice output' : 'Enable voice output'}
            >
              {isSpeakingEnabled ? <SpeakerOnIcon className="w-6 h-6 text-white" /> : <SpeakerOffIcon className="w-6 h-6 text-white" />}
            </button>
            <button
              type="submit"
              className="p-3 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:bg-blue-800"
              disabled={isLoading || !userInput.trim()}
              aria-label="Send message"
            >
              <SendIcon className="w-6 h-6 text-white" />
            </button>
          </form>
          <div className="text-center text-sm text-gray-400 pt-2 h-5">{status}</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
