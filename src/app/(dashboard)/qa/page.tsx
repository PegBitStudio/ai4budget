'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import FormattedAnswer from '@/components/qa/FormattedAnswer';

// --- Interfaces ---

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QAResponse {
  answer: string;
  source: 'local' | 'llm' | 'error';
  needsClarification?: boolean;
}

// --- Constants ---

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ask me anything about your spending, budget, or savings.',
  timestamp: new Date(),
};

const FINANCIAL_ADVICE_KEYWORDS = [
  'invest', 'investment', 'investing',
  'tax', 'taxes', 'taxation',
  'debt', 'loan', 'mortgage',
  'retirement', 'pension',
  'stock', 'stocks', 'bond', 'bonds',
  'portfolio',
];

/**
 * Offered when the chat is still empty. Phrased the way someone would actually
 * ask, and chosen so each one exercises a different part of the assistant.
 */
const STARTER_QUESTIONS = [
  'Why am I over budget?',
  'What should I cut first?',
  'How much did I spend on Dining?',
  'Can I still hit my savings goal?',
];

const DISCLAIMER_TEXT =
  '⚠️ This is general information only and does not constitute professional financial advice. Please consult a qualified financial professional before making investment, tax, or debt decisions.';

// --- Helpers ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function shouldShowDisclaimer(content: string): boolean {
  const lower = content.toLowerCase();
  return FINANCIAL_ADVICE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// --- Component ---

export default function QAPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input.trim());
  }

  async function ask(question: string) {
    if (!question || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      let assistantContent: string;

      if (!response.ok) {
        if (response.status === 401) {
          assistantContent = 'You need to be logged in to ask questions. Please sign in and try again.';
        } else {
          assistantContent = 'Something went wrong while processing your question. Please try again.';
        }
      } else {
        const data: QAResponse = await response.json();
        assistantContent = data.answer;
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Unable to reach the server. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.14)-theme(spacing.16))]">
      {/* Subheader */}
      <div className="px-4 py-2 border-b border-ink-100 bg-paper">
        <p className="text-sm text-ink-500">Ask questions about your finances in plain English</p>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-ink-900 text-paper rounded-br-md'
                  : 'bg-ink-100 text-ink-900 rounded-bl-md'
              }`}
            >
              {message.role === 'assistant' ? (
                <FormattedAnswer text={message.content} />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              )}

              {/* Financial advice disclaimer */}
              {message.role === 'assistant' &&
                message.id !== 'welcome' &&
                shouldShowDisclaimer(message.content) && (
                  <div className="mt-3 pt-3 border-t border-ink-300">
                    <p className="text-xs text-ink-600 leading-relaxed">{DISCLAIMER_TEXT}</p>
                  </div>
                )}

              {message.id !== 'welcome' && (
                <p
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-ink-200' : 'text-ink-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Starter questions — an empty box with "ask me anything" is the
            hardest thing to face, so offer the questions worth asking. */}
        {messages.length === 1 && !isLoading && (
          <div className="flex flex-wrap gap-2 pt-1">
            {STARTER_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => ask(question)}
                className="rounded-full border border-ink-200 bg-ink-50 px-3.5 py-2 text-sm font-medium text-ink-900 transition-colors hover:border-ink-300 hover:bg-ink-100"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-ink-100 rounded-lg rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-ink-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-ink-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-ink-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-ink-200 bg-paper px-4 py-3 pb-[calc(0.75rem+var(--sab))]">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your spending..."
            disabled={isLoading}
            className="flex-1 min-h-[44px] px-4 py-2 text-base bg-ink-50 border border-ink-300 rounded-full focus:outline-none focus:ring-2 focus:ring-ink-700 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Ask a question about your finances"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-ink-900 text-paper rounded-full hover:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send question"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
