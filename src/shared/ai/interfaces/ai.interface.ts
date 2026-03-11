export interface NutritionAnalysisResult {
  foodName: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatStreamOptions {
  messages: ChatMessage[];
  onDelta?: (delta: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
}