export const animationShowcase = {
  name: "Animation Showcase",
  description: "Various animation types and effects",
  content: {
    "scene.mml": `
<m-light y="10" intensity="1000" type="point"></m-light>

<!-- Spinning cubes with different animations -->
<m-cube id="spin-cube-1" x="-3" y="1" color="blue" collide="true" z="-2">
  <m-attr-anim attr="ry" start="0" end="360" duration="2000"></m-attr-anim>
</m-cube>

<m-cube id="bounce-cube" x="0" y="1" color="purple" collide="true" z="-2">
  <m-attr-anim attr="y" start="1" end="3" duration="1000" loop="true" ping-pong="true"></m-attr-anim>
</m-cube>

<m-cube id="spin-cube-2" x="3" y="1" color="orange" collide="true" z="-2">
  <m-attr-anim attr="rx" start="0" end="360" duration="1500"></m-attr-anim>
  <m-attr-anim attr="rz" start="0" end="360" duration="2500"></m-attr-anim>
</m-cube>

<!-- Pulsing sphere -->
<m-sphere id="pulse-sphere" x="0" y="1" z="2" color="yellow" collide="true">
  <m-attr-anim attr="sx" start="1" end="1.5" duration="800" loop="true" ping-pong="true"></m-attr-anim>
  <m-attr-anim attr="sy" start="1" end="1.5" duration="800" loop="true" ping-pong="true"></m-attr-anim>
  <m-attr-anim attr="sz" start="1" end="1.5" duration="800" loop="true" ping-pong="true"></m-attr-anim>
</m-sphere>

<script>
  const cubes = [
    document.getElementById("spin-cube-1"),
    document.getElementById("bounce-cube"),
    document.getElementById("spin-cube-2")
  ];

  cubes.forEach((cube, index) => {
    cube.addEventListener("click", () => {
      const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7"];
      cube.setAttribute("color", colors[Math.floor(Math.random() * colors.length)]);
    });
  });

  const sphere = document.getElementById("pulse-sphere");
  sphere.addEventListener("click", () => {
    sphere.setAttribute("color", "#" + Math.floor(Math.random() * 16777215).toString(16));
  });
</script>
`,
  },
};
