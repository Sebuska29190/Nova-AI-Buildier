// Real-time transcription provider (WebSocket-based)
export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
}

export type TranscriptionCallback = (result: TranscriptionResult) => void;

class RealtimeTranscription {
  private active = false;

  async start(callback: TranscriptionCallback): Promise<void> {
    this.active = true;
    // WebSocket connection to real-time STT provider
    // For now, placeholder implementation
    console.log("Real-time transcription started");
  }

  stop(): void {
    this.active = false;
  }
}

export const realtimeTranscription = new RealtimeTranscription();
