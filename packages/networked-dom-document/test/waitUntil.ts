export function waitUntil(checkFn: () => boolean) {
  return new Promise((resolve) => {
    if (checkFn()) {
      resolve(null);
      return;
    }

    const interval = setInterval(() => {
      if (checkFn()) {
        clearInterval(interval);
        clearTimeout(maxTimeout);
        resolve(null);
      }
    }, 10);

    const maxTimeout = setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, 3000);
  });
}
