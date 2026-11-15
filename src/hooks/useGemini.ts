import { useCallback, useRef, useState } from 'react';
import { streamVoiceResponse } from '../services/geminiService';
import { VoiceChatMessage } from '../types/conversation';
import {
  DetectedLanguage,
  GeminiDiagnosticDetails,
  LanguagePreference,
  VoiceStockJsonPayload,
} from '../types/voice';
import { extractCompletedSentences } from '../utils/languageDetector';

export interface AskGeminiVoiceParams {
  message: string;
  languagePreference: LanguagePreference;
  detectedLanguage: DetectedLanguage;
  history: VoiceChatMessage[];
  activeTopic?: string;
  lastEntity?: string;
  marketContext?: VoiceStockJsonPayload | Record<string, unknown> | null;
  detailRequested?: boolean;
  modelName?: string;
  onSentence: (sentence: string) => void;
  onComplete: (fullText: string, diagnostic: GeminiDiagnosticDetails) => void;
  onError: (friendlyError: string, diagnostic: GeminiDiagnosticDetails) => void;
}

export function useGemini() {
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [lastDiagnostic, setLastDiagnostic] = useState<GeminiDiagnosticDetails | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const abortStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const askStreaming = useCallback(
    async (params: AskGeminiVoiceParams) => {
      abortStream();
      const controller = new AbortController();
      abortRef.current = controller;

      setStreamingText('');
      setIsStreaming(true);

      let sentenceBuffer = '';
      let assembled = '';

      await streamVoiceResponse({
        ...params,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (controller.signal.aborted) return;
          assembled += chunk;
          setStreamingText(assembled);

          sentenceBuffer += chunk;
          const { completed, remainder } = extractCompletedSentences(sentenceBuffer);
          sentenceBuffer = remainder;
          for (const s of completed) {
            params.onSentence(s);
          }
        },
        onDone: (fullText, diagnostic) => {
          if (controller.signal.aborted) return;
          const leftover = sentenceBuffer.trim();
          if (leftover.length > 0) {
            params.onSentence(leftover);
          }
          setLastDiagnostic(diagnostic);
          setIsStreaming(false);
          setStreamingText('');
          abortRef.current = null;
          params.onComplete(fullText, diagnostic);
        },
        onError: (err, diagnostic) => {
          if (controller.signal.aborted) return;
          setLastDiagnostic(diagnostic);
          setIsStreaming(false);
          setStreamingText('');
          abortRef.current = null;
          params.onError(err, diagnostic);
        },
      });
    },
    [abortStream]
  );

  return {
    streamingText,
    isStreaming,
    lastDiagnostic,
    askStreaming,
    abortStream,
  };
}
