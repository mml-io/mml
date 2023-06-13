export function waitFor(condition: () => boolean, timeout = 1000) {
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 10);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("waitFor timeout"));
    }, timeout);
  });
}

