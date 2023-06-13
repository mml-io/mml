import { validateMMLDocument } from "../../src";

test("<m-audio>", () => {
  const validationErrors = validateMMLDocument(`
<m-audio
  id="my-audio"
  class="some-audio-class" 
  x="1.1" 
  y="2.2" 
  z="3.3" 
  rx="45.45" 
  ry="90.90" 
  rz="135.135" 
  sx="1.1" 
  sy="2.2" 
  sz="3.3"
  src="https://example.com/some.mp3"
  debug="true"
  loop="true"
  enabled="true"
  volume="1.5"
  ref-distance="1.23"
  roll-off="5.0"
></m-audio>
`);
  expect(validationErrors).toBeNull();
});
