export function assert(value: unknown, message = 'null'): asserts value {
  if (value) return;
  throw new Error('Assertion failed' + (message ? `: ${message}` : ''));
}

export function assertInstanceof<T>(
  value: unknown,
  type: new (...args: any[]) => T,
  message = 'null',
): asserts value is T {
  if (value instanceof type) return;
  throw new Error(
    message || `Value ${value} is not of type ${type.name || typeof type}`,
  );
}

export function assertNotReached(message = 'Unreachable code hit'): never {
  assert(false, message);
  throw new Error(message);
}

export function assertNotReachedCase(_param: never, message = 'null'): never {
  return assertNotReached(message);
}
