import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Edit2, Check, X } from 'lucide-react';
import type { ChatMessage } from '../types';

interface ChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  onSendMessage: (text: string) => void;
  onUpdateUserName?: (name: string) => void;
}

export const Chat: React.FC<ChatProps> = ({
  messages,
  currentUserId,
  currentUserName,
  onSendMessage,
  onUpdateUserName,
}) => {
  const [inputText, setInputText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUserName);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Scroll ONLY the inner chat container, without scrolling the main browser window!
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (clean && onUpdateUserName) {
      onUpdateUserName(clean);
    }
    setIsEditingName(false);
  };

  return (
    <div className="flex flex-col h-full bg-cinema-800 border border-cinema-700/80 rounded-xl overflow-hidden shadow-lg">
      {/* Chat Header */}
      <div className="px-3 py-2.5 bg-cinema-700/60 border-b border-cinema-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cinema-accent" />
          <h3 className="text-xs sm:text-sm font-bold text-white">Live Party Chat</h3>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">
          {messages.length} messages
        </span>
      </div>

      {/* User Display Name Banner with 1-Click Edit */}
      <div className="px-3 py-1.5 bg-cinema-900/90 border-b border-cinema-700/60 flex items-center justify-between text-xs">
        <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-cinema-accent" />
          <span>Chatting as:</span>
        </span>
        {isEditingName ? (
          <form onSubmit={handleSaveName} className="flex items-center gap-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
              autoFocus
              className="px-2 py-0.5 bg-cinema-800 border border-cinema-accent rounded text-xs text-white focus:outline-none w-28"
            />
            <button
              type="submit"
              className="p-1 text-emerald-400 hover:bg-cinema-700 rounded transition"
              title="Save Name"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingName(false)}
              className="p-1 text-gray-400 hover:bg-cinema-700 rounded transition"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setNameInput(currentUserName);
              setIsEditingName(true);
            }}
            className="flex items-center gap-1 font-bold text-gray-200 hover:text-white bg-cinema-800/80 hover:bg-cinema-700 px-2 py-0.5 rounded border border-cinema-700 transition group"
            title="Click to change your username"
          >
            <span className="text-xs text-cinema-accent">{currentUserName}</span>
            <Edit2 className="w-2.5 h-2.5 text-gray-400 group-hover:text-white" />
          </button>
        )}
      </div>

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[160px]"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-8">
            <MessageSquare className="w-8 h-8 stroke-1 mb-2 text-gray-600" />
            <p className="text-xs">No messages yet.</p>
            <p className="text-[10px] text-gray-500">Say hi to your watch buddy!</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center my-1">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-cinema-700/60 text-[10px] text-gray-400 font-medium border border-cinema-600/40">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.senderId === currentUserId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-semibold text-gray-400">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[9px] text-gray-500 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-2xl max-w-[85%] text-xs leading-relaxed break-words shadow-sm ${
                    isMe
                      ? 'bg-cinema-accent text-white rounded-br-xs'
                      : 'bg-cinema-700 text-gray-100 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input */}
      <form
        onSubmit={handleSubmit}
        className="p-2 sm:p-2.5 bg-cinema-900 border-t border-cinema-700 flex items-center gap-1.5"
      >
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-3 py-2 bg-cinema-800 border border-cinema-700 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cinema-accent"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 sm:px-3 sm:py-2 bg-cinema-accent hover:bg-cinema-accentHover disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow transition active:scale-95 flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
