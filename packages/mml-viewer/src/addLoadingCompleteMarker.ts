export function addLoadingCompleteMarker(): void {
  if (!document.getElementById("loading-complete")) {
    const marker = document.createElement("div");
    marker.id = "loading-complete";
    marker.style.display = "none";
    document.body.append(marker);
  }
}
