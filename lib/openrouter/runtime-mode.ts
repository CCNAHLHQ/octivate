import { resetOpenRouterClient } from "./client";

/**
 * Live OpenRouter is the only supported pipeline path.
 * Mock demo mode has been retired from the product surface.
 */

export function getRuntimeMockOverride(): boolean | null {
  return false;
}

export function invalidateRuntimeMockOverride(): void {
  resetOpenRouterClient();
}

export function envMockDefault(): boolean {
  return false;
}

export function resolveMockOpenRouter(): boolean {
  return false;
}
