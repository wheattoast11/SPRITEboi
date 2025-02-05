export class GenerationError extends Error {
  constructor(message: string, public readonly type: string) {
    super(message);
    this.name = 'GenerationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly query?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public readonly retryable: boolean = true) {
    super(message);
    this.name = 'NetworkError';
  }
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof NetworkError) {
    return error.retryable;
  }
  return false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (!isRetryableError(lastError)) {
        throw lastError;
      }
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError!;
}