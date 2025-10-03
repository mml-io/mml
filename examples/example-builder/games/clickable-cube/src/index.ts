// Example Game 1 - Simple Cube Clicker
console.log("Example Game 1 loaded!");

const cube = document.querySelector("m-cube");
if (cube) {
  cube.addEventListener("click", () => {
    console.log("Cube clicked!");
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    cube.setAttribute("color", randomColor);
  });
}

// Initialize game
function init() {
  console.log("Example Game 1 initialized");
}

init();
