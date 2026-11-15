/**
 * A person who plays more than one character is shown once, under their best-scoring character's
 * name. This says so in words: "dead person and 1 other character", not an unexplained "+1".
 */
export function withOtherCharacters(name: string, others: number): string {
  if (others <= 0) return name;
  return `${name} and ${others} other character${others === 1 ? '' : 's'}`;
}
