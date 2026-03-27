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

// AI 调用结果，包含 Token 使用量
export interface AICompletionResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// 营养分析结果（带 Token 使用量）
export interface NutritionAnalysisResultWithTokens extends NutritionAnalysisResult {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// 语音识别结果（带 Token 使用量）
export interface SpeechToTextResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}