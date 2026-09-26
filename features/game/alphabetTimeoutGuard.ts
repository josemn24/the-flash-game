export function createAlphabetTimeoutGuard() {
  let handled = false;

  return {
    claim() {
      if (handled) return false;
      handled = true;
      return true;
    },
  };
}
