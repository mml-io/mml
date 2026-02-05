export function setUrlParam(name: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value === "" || value === null) {
    params.delete(name);
  } else {
    params.set(name, value);
  }
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
