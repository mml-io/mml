import { validateMMLDocument } from "../src";

test("exhaustive tags", () => {
  const validationErrors = validateMMLDocument(`
<m-group>
  <m-light></m-light>
  <m-plane></m-plane>
  <m-cube></m-cube>
  <m-sphere></m-sphere>
  <m-cylinder></m-cylinder>
  <m-prompt></m-prompt>
  <m-interaction></m-interaction>
  <m-model></m-model>
  <m-character></m-character>
  <m-position-probe></m-position-probe>
  <m-chat-probe></m-chat-probe>
  <m-attr-anim></m-attr-anim>
  <m-attr-lerp></m-attr-lerp>
  <m-frame></m-frame>
  <m-label></m-label>
  <m-group></m-group>
  <m-audio></m-audio>
  <m-image></m-image>
  <m-video></m-video>
  <script>
    // Script contents are not validated 
    doSomething();
  </script>
</m-group>
`);
  expect(validationErrors).toBeNull();
});
