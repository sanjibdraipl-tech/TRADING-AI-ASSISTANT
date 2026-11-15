import { VoiceChatMessage, VoiceConversation } from '../types/conversation';

const STORAGE_KEY = 'smart_trader_voice_convos_v1';

export function createNewConversation(
  language: string = 'auto',
  title: string = 'New Voice Session'
): VoiceConversation {
  const now = new Date().toISOString();
  return {
    id: `vconv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    createdAt: now,
    updatedAt: now,
    language,
    activeTopic: 'General',
    lastEntity: '',
    messages: [],
  };
}

export function loadConversations(saveHistory: boolean): VoiceConversation[] {
  if (!saveHistory) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistConversations(conversations: VoiceConversation[], saveHistory: boolean): void {
  try {
    if (!saveHistory) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 40)));
  } catch {
    // ignore quota exceeded
  }
}

export function appendMessageToConversation(
  conversation: VoiceConversation,
  msg: VoiceChatMessage,
  newTopic?: string,
  newEntity?: string
): VoiceConversation {
  const updatedMessages = [...conversation.messages, msg];
  const derivedTitle =
    conversation.title === 'New Voice Session' && msg.role === 'user'
      ? msg.text.slice(0, 36) + (msg.text.length > 36 ? '...' : '')
      : conversation.title;

  return {
    ...conversation,
    title: derivedTitle,
    updatedAt: new Date().toISOString(),
    language: msg.language || conversation.language,
    activeTopic: newTopic || conversation.activeTopic,
    lastEntity: newEntity || conversation.lastEntity,
    messages: updatedMessages,
  };
}

export function exportConversationAsJson(conversation: VoiceConversation): string {
  return JSON.stringify(conversation, null, 2);
}
