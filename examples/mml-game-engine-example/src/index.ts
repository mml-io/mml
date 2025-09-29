import { AppController } from "./AppController";

// Create app controller instance
const appController = new AppController();

// Initialize the game when the page loads
async function initializeGame() {
  await appController.initialize();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGame);
} else {
  initializeGame();
}
