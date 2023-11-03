import { validateMMLDocument } from "../../src";

test("<m-chat-probe>", () => {
  const validationErrors = validateMMLDocument(`
<m-chat-probe
  id="my-chat-probe"
  class="some-chat-probe-class"
  debug="true"
  range="20" 
  x="1.1" 
  y="2.2" 
  z="3.3" 
  rx="45.45" 
  ry="90.90" 
  rz="135.135" 
  sx="1.1" 
  sy="2.2" 
  sz="3.3"
  onchat="console.log('chat', event)"
></m-chat-probe>
`);
  expect(validationErrors).toBeNull();
});
