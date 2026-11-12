import { AIProviderUnavailableError, type AIProvider } from './provider.js';
import { GroqAIProvider } from './groq.js';

class UnconfiguredAIProvider implements AIProvider {
  readonly name = 'unconfigured';
  constructor(private readonly reason = 'ИИ-провайдер пока не подключён') {}
  async transcribeAudio(): Promise<never> {
    throw new AIProviderUnavailableError(this.reason);
  }
  async analyzeMeeting(): Promise<never> {
    throw new AIProviderUnavailableError(this.reason);
  }
}

export class AIProviderFactory {
  static create(): AIProvider {
    const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
    if (!provider || provider === 'none') return new UnconfiguredAIProvider();
    if (provider === 'groq') {
      if (!process.env.GROQ_API_KEY) return new UnconfiguredAIProvider('Провайдер Groq выбран, но GROQ_API_KEY не задан');
      return new GroqAIProvider(process.env.GROQ_API_KEY);
    }
    return new UnconfiguredAIProvider(`Провайдер «${provider}» ещё не подключён к приложению`);
  }
}
