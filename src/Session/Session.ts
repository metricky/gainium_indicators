export enum SessionRuleEnum {
  in = 'in',
  out = 'out',
}

/**
 * Checks if a given timestamp falls within the configured session days.
 * @param timestamp - Unix timestamp in milliseconds
 * @param days - Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param rule - 'in' returns true when day matches, 'out' returns true when day does not match
 */
export function isInSession(
  timestamp: number,
  days: number[],
  rule: SessionRuleEnum | string,
): boolean {
  const day = new Date(timestamp).getUTCDay()
  const dayMatch = days.includes(day)
  return rule === SessionRuleEnum.out ? !dayMatch : dayMatch
}
