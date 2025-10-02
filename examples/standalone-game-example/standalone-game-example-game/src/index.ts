const cube = document.querySelector("m-cube");
console.log({cube});
cube?.addEventListener("click", () => {
  console.log("clicked!");
  cube?.setAttribute("color", "#" + Math.floor(Math.random() * 16777215).toString(16));
});