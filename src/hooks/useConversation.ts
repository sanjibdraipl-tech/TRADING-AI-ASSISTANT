import { useCallback, useEffect, useState } from 'react';
import { VoiceChatMessage, VoiceConversation } from '../types/conversation';
import {
  appendMessageToConversation,
  createNewConversation,
  exportConversationAsJson,
  loadConversations,
  persistConversations,
} from '../services/conversationService';

export function useConversation(saveHistory: boolean) {
  const [conversations, setConversations] = useState<VoiceConversation[]>(() => {
    const loaded = loadConversations(saveHistory);
    return loaded.length > 0 ? loaded : [createNewConversation('auto', 'Market Voice Session')];
  });

  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id || '');

  useEffect(() => {
    persistConversations(conversations, saveHistory);
  }, [conversations, saveHistory]);

  const activeConversation =
    conversations.find((c) => c.id === activeId) || conversations[0] || createNewConversation();

  const addMessage = useCallback(
    (msg: VoiceChatMessage, newTopic?: string, newEntity?: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? appendMessageToConversation(c, msg, newTopic, newEntity)
            : c
        )
      );
    },
    [activeConversation.id]
  );

  const editMessageText = useCallback(
    (msgId: string, newText: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                messages: c.messages.map((m) => (m.id === msgId ? { ...m, text: newText } : m)),
              }
            : c
        )
      );
    },
    [activeConversation.id]
  );

  const deleteMessage = useCallback(
    (msgId: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) }
            : c
        )
      );
    },
    [activeConversation.id]
  );

  const newConversation = useCallback((lang: string = 'auto') => {
    const fresh = createNewConversation(lang, 'New Voice Session');
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    return fresh;
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    const cleaned = title.trim();
    if (!cleaned) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: cleaned, updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (remaining.length === 0) {
          const fresh = createNewConversation('auto', 'Market Voice Session');
          setActiveId(fresh.id);
          return [fresh];
        }
        if (activeId === id) {
          setActiveId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeId]
  );

  const clearActiveMessages = useCallback(() => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [], activeTopic: 'General', lastEntity: '' }
          : c
      )
    );
  }, [activeConversation.id]);

  const exportActiveJson = useCallback(() => {
    return exportConversationAsJson(activeConversation);
  }, [activeConversation]);

  return {
    conversations,
    activeConversation,
    setActiveId,
    addMessage,
    editMessageText,
    deleteMessage,
    newConversation,
    renameConversation,
    deleteConversation,
    clearActiveMessages,
    exportActiveJson,
  };
}
