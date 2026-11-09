/**
 * Adds the members of `parts` to the prototype of `cls`: one class, one `this`, its code grouped by theme across files.
 * Used by the three classes too long for a single file (Story, Npc, Brain).
 */
export function mixin(cls, ...parts) {
  for (const part of parts) Object.defineProperties(cls.prototype, Object.getOwnPropertyDescriptors(part));
}
