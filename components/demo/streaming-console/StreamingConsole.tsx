
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef } from 'react';
import WelcomeScreen from '../welcome-screen/WelcomeScreen';
// FIX: Import LiveServerContent to correctly type the content handler.
import { Modality, LiveServerContent, LiveServerToolCall } from '@google/genai';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  ConversationTurn,
  declaration,
} from '../../../lib/state';
import { useHistoryStore } from '../../../lib/history';
import { useAuth, updateUserConversations, fetchUserConversations } from '../../../lib/auth';

export default function StreamingConsole() {
  const { client, setConfig } = useLiveAPIContext();
  const { systemPrompt, voice1, guestLanguage, staffLanguage, lastGuestLanguage, setLastGuestLanguage } = useSettings();
  const { addHistoryItem } = useHistoryStore();
  const { user } = useAuth();

  const turns = useLogStore(state => state.turns);

  // Fetch history on mount
  useEffect(() => {
    if (user) {
      fetchUserConversations(user.id).then(history => {
        useLogStore.getState().setTurns(history);
      });
    }
  }, [user]);

  // Set the configuration for the Live API
  useEffect(() => {
    // Using `any` for config to accommodate `speechConfig`, which is not in the
    // current TS definitions but is used in the working reference example.
    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice1,
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      tools: [
        { functionDeclarations: [declaration] }
      ],
    };

    setConfig(config);
  }, [setConfig, systemPrompt, voice1]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      
      // Heuristic for Input: If it contains Dutch-specific characters or common Dutch words, it's likely Staff.
      // Otherwise, we assume Guest until the model says otherwise.
      const isDutch = /^[a-zA-Z\s]+$/.test(text) && (
        text.toLowerCase().includes('ben') || 
        text.toLowerCase().includes('jij') || 
        text.toLowerCase().includes('een') || 
        text.toLowerCase().includes('hoe') ||
        text.toLowerCase().includes('wat')
      );
      const speaker = isDutch ? 'Staff' : 'Guest';

      if (last && last.role === 'user' && !last.isFinal) {
        updateLastTurn({
          text: last.text + text,
          isFinal,
          detectedSpeaker: speaker,
          detectedLanguage: isDutch ? staffLanguage : (guestLanguage === 'auto' ? lastGuestLanguage : guestLanguage)
        });
      } else {
        addTurn({ 
          role: 'user', 
          text, 
          isFinal,
          detectedSpeaker: speaker,
          detectedLanguage: isDutch ? staffLanguage : (guestLanguage === 'auto' ? lastGuestLanguage : guestLanguage)
        });
      }
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({
          text: last.text + text,
          isFinal,
        });
      } else {
        addTurn({ role: 'agent', text, isFinal });
      }
    };

    // FIX: The 'content' event provides a single LiveServerContent object.
    const handleContent = (serverContent: LiveServerContent) => {
      const text =
        serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      const groundingChunks = serverContent.groundingMetadata?.groundingChunks;

      if (!text && !groundingChunks) return;

      const { turns, addTurn, updateLastTurn } = useLogStore.getState();
      const last = turns[turns.length - 1];

      // Heuristic for Output:
      // If the model output is Dutch, it's a translation for the Staff (Guest was original speaker).
      // If the model output is anything else, it's a translation for the Guest (Staff was original speaker).
      const outputIsDutch = (text.toLowerCase().includes('is') || text.toLowerCase().includes('het')) && !/[\u0600-\u06FF]/.test(text);
      const speakerRole = outputIsDutch ? 'Guest' : 'Staff'; 
      const targetLang = outputIsDutch ? staffLanguage : (guestLanguage === 'auto' ? lastGuestLanguage : guestLanguage);

      if (last?.role === 'agent' && !last.isFinal) {
        const updatedTurn: Partial<ConversationTurn> = {
          text: last.text + text,
          detectedSpeaker: speakerRole,
          detectedLanguage: targetLang
        };
        if (groundingChunks) {
          updatedTurn.groundingChunks = [
            ...(last.groundingChunks || []),
            ...groundingChunks,
          ];
        }
        updateLastTurn(updatedTurn);
      } else {
          addTurn({ 
            role: 'agent', 
            text, 
            isFinal: false, 
            groundingChunks,
            detectedSpeaker: speakerRole,
            detectedLanguage: targetLang
          });
      }
    };

    const handleTurnComplete = () => {
      const { turns, updateLastTurn } = useLogStore.getState();
      const last = turns[turns.length - 1];

      if (last && !last.isFinal) {
        updateLastTurn({ isFinal: true });
        const updatedTurns = useLogStore.getState().turns;

        if (user) {
          updateUserConversations(user.id, updatedTurns);
        }

        const finalAgentTurn = updatedTurns[updatedTurns.length - 1];

        if (finalAgentTurn?.role === 'agent' && finalAgentTurn?.text) {
          const agentTurnIndex = updatedTurns.length - 1;
          let correspondingUserTurn = null;
          for (let i = agentTurnIndex - 1; i >= 0; i--) {
            if (updatedTurns[i].role === 'user') {
              correspondingUserTurn = updatedTurns[i];
              break;
            }
          }

          if (correspondingUserTurn?.text) {
            const translatedText = finalAgentTurn.text.trim();
            addHistoryItem({
              sourceText: correspondingUserTurn.text.trim(),
              translatedText: translatedText,
              lang1: guestLanguage,
              lang2: staffLanguage
            });
          }
        }
      }
    };
    const handleToolCall = (toolCall: LiveServerToolCall) => {
      const fc = toolCall.functionCalls.find(f => f.name === 'report_guest_language');
      if (fc) {
        const { language } = fc.args as any;
        if (language) {
          const { turns } = useLogStore.getState();
          setLastGuestLanguage(language);
          
          // Update the most recent user turn with the detected language and speaker
          for (let i = turns.length - 1; i >= 0; i--) {
            if (turns[i].role === 'user') {
              useLogStore.getState().updateLastTurn({ 
                detectedSpeaker: 'Guest',
                detectedLanguage: language 
              });
              break;
            }
          }
          // Send response back to satisfy the client
          client.sendToolResponse({
            functionResponses: toolCall.functionCalls.map(f => ({
              id: f.id,
              response: { output: { success: true } }
            }))
          });
        }
      }
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', handleContent);
    client.on('turncomplete', handleTurnComplete);
    client.on('toolcall', handleToolCall);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', handleContent);
      client.off('turncomplete', handleTurnComplete);
      client.off('toolcall', handleToolCall);
    };
  }, [client, addHistoryItem, user, guestLanguage, staffLanguage]);

  return (
    <div className="transcription-container">
      <WelcomeScreen />
    </div>
  );
}
