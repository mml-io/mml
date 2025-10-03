/* eslint-env browser */
/* global console, window */
// Helper utility functions
console.log("Helper script loaded!");

window.helperUtils = {
  randomColor() {
    return "#" + Math.floor(Math.random() * 16777215).toString(16);
  },

  logMessage(message) {
    console.log("[Helper]", message);
  },
};
