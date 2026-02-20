export const stripEmpty = <T extends Record<string, unknown>>(payload: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  ) as Partial<T>;
};
