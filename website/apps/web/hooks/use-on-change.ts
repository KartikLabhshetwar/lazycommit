import * as React from "react";

function isDifference(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.length !== a.length || a.some((v, i) => v !== b[i]);
  }
  return a !== b;
}

export function useOnChange<T>(
  value: T,
  onChange: (value: T) => void,
  isUpdated: (prev: T, current: T) => boolean = isDifference,
): void {
  const [prev, setPrev] = React.useState<T>(value);
  if (isUpdated(prev, value)) {
    onChange(value);
    setPrev(value);
  }
}
