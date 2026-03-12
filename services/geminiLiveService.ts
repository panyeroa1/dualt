
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { APP_CONFIG } from '../constants';
import { encode, decode, decodeAudioData, float32ToInt16 } from './audioUtils';

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any; // Using any for session as types from SDK are evolving
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isConnected = false;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect(config: {
    staffLanguage: string;
    visitorLanguage: string;
    onTranscription: (text: string, isInput: boolean) => void;
    onTurnComplete: (input: string, output: string) => void;
    onError: (e: any) => void;
  }) {
    if (this.isConnected) return;

    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: APP_CONFIG.SAMPLE_RATE_INPUT });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: APP_CONFIG.SAMPLE_RATE_OUTPUT });
    
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const systemInstruction = `You are a professional dual-language translator for Eburon. 
    You are facilitating a conversation between a STAFF member and a VISITOR.
    
    Current configuration:
    - STAFF Language: ${config.staffLanguage}
    - VISITOR Language: ${config.visitorLanguage}
    
    CRITICAL RULES:
    1. If a participant's language is set to "Autodetect", you MUST detect the language they are speaking from their first turn.
    2. Once a language is detected for an "Autodetect" participant, remember it for the rest of the session.
    3. TRANSLATION DIRECTION:
       - Translate STAFF speech into the VISITOR's language. If VISITOR is "Autodetect" and no language has been detected yet, translate into English.
       - Translate VISITOR speech into the STAFF's language. If STAFF is "Autodetect" and no language has been detected yet, translate into English.
    4. Be neutral and professional. Mimic the tone and emotion of the source (laugh if they laugh, etc.).
    5. Provide clear, natural spoken translations. Do not censor or filter.
    6. Ensure transcription is accurate for both participants.`;

    const sessionPromise = this.ai.live.connect({
      model: APP_CONFIG.MODEL_NAME,
      callbacks: {
        onopen: () => {
          this.isConnected = true;
          this.startStreaming(sessionPromise);
        },
        onmessage: async (message: LiveServerMessage) => {
          this.handleServerMessage(message, config.onTranscription, config.onTurnComplete);
        },
        onerror: (e) => {
          console.error('Gemini Live Error:', e);
          config.onError(e);
        },
        onclose: () => {
          this.isConnected = false;
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    });

    this.session = await sessionPromise;
  }

  private startStreaming(sessionPromise: Promise<any>) {
    if (!this.stream || !this.inputAudioContext) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const int16 = float32ToInt16(inputData);
      const data = encode(new Uint8Array(int16.buffer));

      sessionPromise.then((session) => {
        session.sendRealtimeInput({
          media: {
            data,
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      });
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(
    message: LiveServerMessage,
    onTranscription: (text: string, isInput: boolean) => void,
    onTurnComplete: (input: string, output: string) => void
  ) {
    // Audio Output
    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audioData && this.outputAudioContext) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      const audioBuffer = await decodeAudioData(
        decode(audioData),
        this.outputAudioContext,
        APP_CONFIG.SAMPLE_RATE_OUTPUT,
        1
      );
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
      source.onended = () => this.sources.delete(source);
    }

    // Transcription Handling
    if (message.serverContent?.inputTranscription) {
      onTranscription(message.serverContent.inputTranscription.text, true);
    }
    if (message.serverContent?.outputTranscription) {
      onTranscription(message.serverContent.outputTranscription.text, false);
    }

    // Interruptions
    if (message.serverContent?.interrupted) {
      this.sources.forEach(s => s.stop());
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  disconnect() {
    if (this.session) {
      // session.close is usually how you stop it
      try { this.session.close(); } catch(e) {}
    }
    if (this.scriptProcessor) this.scriptProcessor.disconnect();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.outputAudioContext) this.outputAudioContext.close();
    this.isConnected = false;
  }
}
