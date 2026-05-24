/**
 * Voice Mode — continuous voice conversation with Nova agent.
 * Uses browser Web Speech API for speech-to-text and Nova's TTS for response.
 *
 * Start voice mode from ChatPage with the 🎤 button.
 */

export interface VoiceConfig {
  /** Speech recognition language (default: pl-PL for Polish) */
  language: string;
  /** Continuous mode — keep listening after each response */
  continuous: boolean;
  /** TTS voice to use for responses */
  ttsVoice: string;
  /** Auto-send when pause detected (ms of silence) */
  autoSendThreshold: number;
}

const DEFAULT_CONFIG: VoiceConfig = {
  language: "pl-PL",
  continuous: true,
  ttsVoice: "pl-PL-StanislawNeural",
  autoSendThreshold: 1500,
};

type VoiceState = "idle" | "listening" | "processing" | "speaking";

type VoiceCallback = {
  onTranscript: (text: string) => void;
  onStateChange: (state: VoiceState) => void;
  onResponse: (text: string) => void;
  onError: (error: string) => void;
};

/**
 * Voice Mode Controller — manages speech recognition and synthesis lifecycle.
 * Use in ChatPage to enable voice input/output.
 */
export class VoiceMode {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private config: VoiceConfig;
  private callbacks: VoiceCallback;
  private state: VoiceState = "idle";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isMuted = false;

  constructor(config: Partial<VoiceConfig> = {}, callbacks: VoiceCallback) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.synthesis = window.speechSynthesis;
  }

  getState(): VoiceState { return this.state; }

  private setState(s: VoiceState) {
    this.state = s;
    this.callbacks.onStateChange(s);
  }

  /**
   * Start listening for voice input.
   */
  start(): void {
    if (this.state === "listening") return;

    const SpeechRecognition = (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.callbacks.onError("Speech recognition not supported in this browser. Try Chrome or Edge.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.config.language;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    let finalTranscript = "";

    this.recognition.onresult = (event: any) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      // Reset silence timer on new input
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      if (finalTranscript.trim()) {
        this.silenceTimer = setTimeout(() => {
          // Auto-send after silence
          if (finalTranscript.trim()) {
            const text = finalTranscript.trim();
            finalTranscript = "";
            this.callbacks.onTranscript(text);
          }
        }, this.config.autoSendThreshold);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return; // Ignore silence
      this.callbacks.onError(`Speech error: ${event.error}`);
      this.setState("idle");
    };

    this.recognition.onend = () => {
      if (this.state === "listening" && this.config.continuous) {
        // Restart if still in listening mode
        try { this.recognition?.start(); } catch {}
      } else {
        this.setState("idle");
      }
    };

    try {
      this.recognition.start();
      this.setState("listening");
    } catch (e) {
      this.callbacks.onError(`Failed to start voice: ${e}`);
    }
  }

  /**
   * Stop listening.
   */
  stop(): void {
    try {
      this.recognition?.stop();
    } catch {}
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.recognition = null;
    this.setState("idle");
  }

  /**
   * Speak a response text using TTS.
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synthesis || this.isMuted) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.config.language;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to find a matching voice
      const voices = this.synthesis.getVoices();
      const preferred = voices.find(v => v.name.includes(this.config.ttsVoice) || v.lang.startsWith(this.config.language.split("-")[0]));
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => this.setState("speaking");
      utterance.onend = () => {
        this.setState("idle");
        resolve();
      };
      utterance.onerror = () => {
        this.setState("idle");
        resolve();
      };

      this.synthesis.speak(utterance);
    });
  }

  /**
   * Cancel any ongoing speech.
   */
  cancelSpeech(): void {
    this.synthesis?.cancel();
    this.setState("idle");
  }

  /**
   * Toggle mute for TTS responses.
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) this.cancelSpeech();
    return this.isMuted;
  }

  /**
   * Toggle voice on/off.
   */
  toggle(): boolean {
    if (this.state === "listening") {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  /**
   * Clean up.
   */
  destroy(): void {
    this.stop();
    this.cancelSpeech();
    this.synthesis = null;
  }
}

/**
 * Check if browser supports speech recognition.
 */
export function isVoiceSupported(): boolean {
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}
