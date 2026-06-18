'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Memo {
  id: string;
  content: string;
  response?: string;
  status: 'draft' | 'pending' | 'retrying' | 'done' | 'error';
  createdAt: number;
  retryAt?: number;
  retryCount?: number;
  error?: string;
}

const STORAGE_KEY = 'claude-memos';
const API_KEY_STORAGE = 'claude-api-key';
const RETRY_INTERVAL = 5 * 60 * 1000;

export default function Home() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasEnvKey, setHasEnvKey] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notifGranted, setNotifGranted] = useState(false);
  const apiKeyRef = useRef(apiKey);
  const hasEnvKeyRef = useRef(hasEnvKey);

  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);
  useEffect(() => { hasEnvKeyRef.current = hasEnvKey; }, [hasEnvKey]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setMemos(JSON.parse(stored)); } catch {}
    }
    const storedKey = localStorage.getItem(API_KEY_STORAGE);
    if (storedKey) setApiKey(storedKey);

    fetch('/api/check-key')
      .then(r => r.json())
      .then(d => setHasEnvKey(d.hasKey))
      .catch(() => {});

    if ('Notification' in window) {
      setNotifGranted(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
  }, [memos]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const requestNotification = async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      setNotifGranted(perm === 'granted');
    }
  };

  const sendMemo = useCallback(async (id: string, content: string) => {
    setSending(id);
    setMemos(prev =>
      prev.map(m => m.id === id ? { ...m, status: 'pending' as const } : m)
    );

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          apiKey: hasEnvKeyRef.current ? undefined : apiKeyRef.current,
        }),
      });

      const data = await res.json();

      if (res.status === 429 || res.status === 529) {
        const retryAfter = (data.retryAfterSeconds ?? 300) * 1000;
        setMemos(prev =>
          prev.map(m =>
            m.id === id ? {
              ...m,
              status: 'retrying' as const,
              retryAt: Date.now() + retryAfter,
              retryCount: (m.retryCount ?? 0) + 1,
              error: 'レート制限中。自動的に再試行します。',
            } : m
          )
        );
      } else if (!res.ok) {
        setMemos(prev =>
          prev.map(m =>
            m.id === id ? { ...m, status: 'error' as const, error: data.error ?? '送信失敗' } : m
          )
        );
      } else {
        setMemos(prev =>
          prev.map(m =>
            m.id === id ? {
              ...m,
              status: 'done' as const,
              response: data.response,
              error: undefined,
              retryAt: undefined,
            } : m
          )
        );
        setExpanded(id);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Claudeから返信が届きました ✓', {
            body: data.response.slice(0, 120),
          });
        }
      }
    } catch {
      setMemos(prev =>
        prev.map(m =>
          m.id === id ? {
            ...m,
            status: 'retrying' as const,
            retryAt: Date.now() + RETRY_INTERVAL,
            retryCount: (m.retryCount ?? 0) + 1,
            error: 'ネットワークエラー。自動的に再試行します。',
          } : m
        )
      );
    } finally {
      setSending(null);
    }
  }, []);

  // Auto-retry: check every second if any memo's retryAt has passed
  useEffect(() => {
    if (sending) return;
    const toRetry = memos.find(
      m => m.status === 'retrying' && m.retryAt !== undefined && m.retryAt <= now
    );
    if (toRetry) {
      sendMemo(toRetry.id, toRetry.content);
    }
  }, [now, memos, sending, sendMemo]);

  const handleSend = () => {
    if (!input.trim()) return;
    const memo: Memo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      content: input.trim(),
      status: 'pending',
      createdAt: Date.now(),
    };
    setMemos(prev => [memo, ...prev]);
    setInput('');
    sendMemo(memo.id, memo.content);
  };

  const handleSaveDraft = () => {
    if (!input.trim()) return;
    const memo: Memo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      content: input.trim(),
      status: 'draft',
      createdAt: Date.now(),
    };
    setMemos(prev => [memo, ...prev]);
    setInput('');
  };

  const canSend = input.trim().length > 0 && (hasEnvKey || apiKey.length > 0);
  const retryingCount = memos.filter(m => m.status === 'retrying').length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-xl mx-auto px-4 py-6 pb-10">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Claude Memo</h1>
            <p className="text-gray-500 text-sm mt-0.5">クレジット回復後に自動送信</p>
          </div>
          {retryingCount > 0 && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full border border-orange-500/30">
              {retryingCount}件 再試行待ち
            </span>
          )}
        </div>

        {/* Notification banner */}
        {!notifGranted && (
          <button
            onClick={requestNotification}
            className="w-full mb-4 text-sm text-left p-3 rounded-xl bg-blue-950/50 border border-blue-800/50 text-blue-300 hover:bg-blue-900/50 transition-colors"
          >
            🔔 返信が届いたときに通知を受け取る →
          </button>
        )}

        {/* API Key input */}
        {!hasEnvKey && (
          <div className="mb-4 rounded-xl bg-gray-900 border border-gray-800 p-4">
            <label className="text-xs text-gray-500 mb-2 block">Anthropic API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => {
                  setApiKey(e.target.value);
                  localStorage.setItem(API_KEY_STORAGE, e.target.value);
                }}
                placeholder="sk-ant-api..."
                className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 outline-none border border-gray-700 focus:border-gray-500"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-3 text-xs text-gray-500 hover:text-white transition-colors"
              >
                {showKey ? '隠す' : '表示'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              キーはブラウザのみに保存されます。サーバーには送信されません。
            </p>
          </div>
        )}

        {/* Input area */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden mb-4">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
            }}
            placeholder="Claudeへのメモを書く...\n\nクレジットが制限中でも下書き保存できます。"
            rows={6}
            className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-white placeholder-gray-700 outline-none resize-none leading-relaxed"
          />
          <div className="flex gap-2 p-3 pt-1">
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              送信
              <span className="hidden sm:inline text-xs opacity-50 ml-1">Ctrl+Enter</span>
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={!input.trim()}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg text-sm transition-colors"
            >
              下書き
            </button>
          </div>
        </div>

        {/* Memo list */}
        {memos.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">メモ一覧</p>
            {memos.map(memo => (
              <MemoCard
                key={memo.id}
                memo={memo}
                isExpanded={expanded === memo.id}
                isSending={sending === memo.id}
                now={now}
                onToggleExpand={() => setExpanded(expanded === memo.id ? null : memo.id)}
                onSend={() => sendMemo(memo.id, memo.content)}
                onDelete={() => {
                  setMemos(prev => prev.filter(m => m.id !== memo.id));
                  if (expanded === memo.id) setExpanded(null);
                }}
                onCancelRetry={() =>
                  setMemos(prev =>
                    prev.map(m =>
                      m.id === memo.id
                        ? { ...m, status: 'draft' as const, retryAt: undefined, error: undefined }
                        : m
                    )
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemoCard({
  memo, isExpanded, isSending, now,
  onToggleExpand, onSend, onDelete, onCancelRetry,
}: {
  memo: Memo;
  isExpanded: boolean;
  isSending: boolean;
  now: number;
  onToggleExpand: () => void;
  onSend: () => void;
  onDelete: () => void;
  onCancelRetry: () => void;
}) {
  const countdown = memo.retryAt ? Math.max(0, memo.retryAt - now) : 0;
  const mins = Math.floor(countdown / 60000);
  const secs = Math.floor((countdown % 60000) / 1000);

  const statusBadge = () => {
    switch (memo.status) {
      case 'draft':
        return <span className="text-xs text-gray-500">下書き</span>;
      case 'pending':
        return (
          <span className="text-xs text-yellow-400 flex items-center gap-1">
            <span className="inline-block animate-spin leading-none">↻</span>
            送信中...
          </span>
        );
      case 'retrying':
        return (
          <span className="text-xs text-orange-400">
            {countdown > 0
              ? `${mins}:${secs.toString().padStart(2, '0')} 後に再試行`
              : '再試行中...'}
            {memo.retryCount && memo.retryCount > 1 ? ` (${memo.retryCount}回目)` : ''}
          </span>
        );
      case 'done':
        return <span className="text-xs text-green-400">✓ 完了</span>;
      case 'error':
        return <span className="text-xs text-red-400">エラー</span>;
    }
  };

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <button onClick={onToggleExpand} className="text-left w-full">
              <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">
                {memo.content}
              </p>
            </button>
            <div className="flex items-center gap-2 mt-2">
              {statusBadge()}
            </div>
            {memo.error && (memo.status === 'retrying' || memo.status === 'error') && (
              <p className="text-xs text-gray-600 mt-1">{memo.error}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(memo.status === 'draft' || memo.status === 'error') && (
              <button
                onClick={onSend}
                disabled={isSending}
                className="text-xs px-2.5 py-1.5 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                送信
              </button>
            )}
            {memo.status === 'retrying' && (
              <>
                <button
                  onClick={onSend}
                  className="text-xs px-2.5 py-1.5 bg-orange-700 hover:bg-orange-600 active:bg-orange-800 text-white rounded-lg transition-colors"
                >
                  今すぐ
                </button>
                <button
                  onClick={onCancelRetry}
                  className="text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
                >
                  停止
                </button>
              </>
            )}
            <button
              onClick={onDelete}
              className="text-gray-700 hover:text-red-400 p-1.5 rounded-lg transition-colors"
              aria-label="削除"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {memo.status === 'done' && (
          <button
            onClick={onToggleExpand}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isExpanded ? '閉じる ▲' : '回答を見る ▼'}
          </button>
        )}
      </div>

      {isExpanded && memo.response && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-800">
          <p className="text-xs text-gray-600 mb-2">Claudeの回答</p>
          <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {memo.response}
          </div>
        </div>
      )}
    </div>
  );
}
