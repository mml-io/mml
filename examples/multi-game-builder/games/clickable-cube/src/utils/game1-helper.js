// Helper utilities for Example Game 1
console.log("Game 1 helper script loaded!");

window.game1Utils = {
  generateRandomColor: function() {
    return "#" + Math.floor(Math.random() * 16777215).toString(16);
  },
  
  logGameEvent: function(event) {
    console.log("[Game 1]", event);
  }
};
