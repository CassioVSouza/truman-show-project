declare function structuredClone<T>(value: T): T;
declare const console: { log(...args: unknown[]): void };
declare const process: { env: Record<string, string | undefined> };
declare const performance: { now(): number };
