export interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  accumulatedChanges?: string[];
  suggestedPrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  includedImage?: {
    base64: string;
    mimeType: string;
  };
}
export interface ImageVersion {
  id: string;
  base64: string;
  mimeType: string;
  mediaId?: string;
  prompt: string;
  timestamp: string;
  aspectRatio: string;
  title: string;
}

export interface LocalAction {
	name: string;
	arguments: unknown;
}
