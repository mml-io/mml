// Raycasts demo script: logs incoming mouse actions and rays
console.log("Raycasts demo loaded");

const control = document.getElementById("mouse-control");
if (control) {
  control.addEventListener("input", (ev: any) => {
    const d = ev.detail || {};
    console.log("mouse-control input", d);
  });
}


