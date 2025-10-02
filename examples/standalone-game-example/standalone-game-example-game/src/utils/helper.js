// Helper utility functions
console.log("Helper script loaded!");

window.helperUtils = {
  randomColor: function() {
    return "#" + Math.floor(Math.random() * 16777215).toString(16);
  },
  
  logMessage: function(message) {
    console.log("[Helper]", message);
  }
};
