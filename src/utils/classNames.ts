/**
 * Utility function to conditionally join class names together
 * @param classes Array of class names or conditional class name objects
 * @returns Combined class names as a single string
 */
export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
