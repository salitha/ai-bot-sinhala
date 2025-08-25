
import React from 'react';
import type { Message } from '../types';
import { MessageRole } from '../types';
import { BotIcon, UserIcon } from './Icons';

interface MessageProps {
  message: Message;
}

const MessageComponent: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;
  const isSystem = message.role === MessageRole.SYSTEM;

  const containerClasses = `flex items-start gap-3 my-4 ${isUser ? 'flex-row-reverse' : ''}`;
  const bubbleClasses = `p-4 rounded-2xl max-w-lg ${
    isUser
      ? 'bg-blue-600 text-white rounded-br-none'
      : 'bg-gray-700 text-gray-200 rounded-bl-none'
  }`;
   const systemBubbleClasses = 'p-3 rounded-lg max-w-lg bg-gray-800 text-gray-400 text-center italic w-full text-sm';


  if (isSystem) {
    return (
        <div className="flex justify-center my-2">
            <div className={systemBubbleClasses}>
                {message.text}
            </div>
        </div>
    )
  }

  return (
    <div className={containerClasses}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-600' : 'bg-gray-600'}`}>
        {isUser ? <UserIcon className="w-5 h-5 text-white" /> : <BotIcon className="w-5 h-5 text-white" />}
      </div>
      <div className={bubbleClasses}>
        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
        {message.imageUrl && (
          <div className="mt-2">
            <img src={message.imageUrl} alt="Generated" className="rounded-lg max-w-xs" />
            <a 
              href={message.imageUrl} 
              download="generated-image.jpg" 
              className="mt-2 inline-block text-sm text-blue-300 hover:text-blue-200"
            >
              Download Image
            </a>
          </div>
        )}
        {message.searchResults && message.searchResults.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold text-sm mb-2 text-gray-300">Sources:</h4>
            <ul className="space-y-2">
              {message.searchResults.map((result, index) => (
                <li key={index} className="text-xs">
                  <a
                    href={result.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:underline break-all"
                  >
                    {index + 1}. {result.title || result.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageComponent;
