import { env } from '../../config/env';
import { NotImplementedError } from '../../utils/errors';
import type { ExtractedJobRequirements, ExtractJobRequirementsInput } from './ai.types';

/**
 * Internal AI Model Adapter (Adapter pattern) - NOT a separate microservice.
 * JobService depends only on this interface, so the concrete AI provider
 * can be swapped without touching business logic.
 */
export interface AIModelAdapter {
  /** Optional collaborator: derive structured requirements from a job description. */
  extractJobRequirements(input: ExtractJobRequirementsInput): Promise<ExtractedJobRequirements>;
}

/** Default adapter used until a real provider is chosen. Makes no external calls. */
export class StubAIModelAdapter implements AIModelAdapter {
  async extractJobRequirements(_input: ExtractJobRequirementsInput): Promise<ExtractedJobRequirements> {
    // TODO (optional): Implement a real provider adapter in its own class
    // (e.g. OpenAIModelAdapter implements AIModelAdapter) and select it below.
    throw new NotImplementedError('AIModelAdapter.extractJobRequirements');
  }
}

export function createAIModelAdapter(provider: string = env.aiProvider): AIModelAdapter {
  switch (provider) {
    // TODO: case 'openai': return new OpenAIModelAdapter(env.aiApiKey);
    // TODO: case 'gemini': ...
    case 'none':
    default:
      return new StubAIModelAdapter();
  }
}
