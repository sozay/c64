export function selectElement(selector, scope = document) {
  const element = scope.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}
