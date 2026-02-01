export interface RetryOptions {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
}

const defaultRetryOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    shouldRetry: (error) => {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return message.includes('network') ||
                   message.includes('fetch') ||
                   message.includes('timeout') ||
                   message.includes('503') ||
                   message.includes('502') ||
                   message.includes('500');
        }
        return false;
    },
    onRetry: () => {},
};

export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...defaultRetryOptions, ...options };

    let lastError: unknown;
    let delay = opts.initialDelay;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < opts.maxAttempts && opts.shouldRetry(error)) {
                opts.onRetry(attempt, error);
                await sleep(delay);
                delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
            } else {
                break;
            }
        }
    }

    throw lastError;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class RetryError extends Error {
    constructor(
        message: string,
        public readonly cause: unknown,
        public readonly attempts: number
    ) {
        super(message);
        this.name = 'RetryError';
    }
}

export async function retryWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    try {
        return await retry(primaryFn, options);
    } catch (error) {
        console.warn('Primary function failed, trying fallback:', error);
        return await fallbackFn();
    }
}

export class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';

    constructor(
        private readonly threshold: number = 5,
        private readonly timeout: number = 60000
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'half-open';
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'closed';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'open';
        }
    }

    reset(): void {
        this.failures = 0;
        this.state = 'closed';
    }

    isOpen(): boolean {
        return this.state === 'open';
    }
}

export async function fetchWithRetry(
    url: string,
    options?: RequestInit,
    retryOptions?: RetryOptions
): Promise<Response> {
    return retry(async () => {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
    }, retryOptions || {});
}
