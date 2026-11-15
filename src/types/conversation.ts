import { DetectedLanguage } from './voice';

export interface VoiceChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  inputMode: 'voice' | 'text';
  language: DetectedLanguage;
  intent?: string;
  symbol?: string;
  confidence?: number;
  isRealGemini?: boolean;
  isDemoFallback?: boolean;
  modelName?: string;
}

export interface VoiceConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  language: string; // e.g. 'bn-IN' | 'en-IN' | 'bn-en'
  activeTopic: string;
  lastEntity: string;
  messages: VoiceChatMessage[];
}
