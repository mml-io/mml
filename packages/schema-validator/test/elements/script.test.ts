import { validateMMLDocument } from "../../src";

test("<script>>", () => {
  const validationErrors = validateMMLDocument(`
<script>
// Script contents are not validated 
doSomething();
</script>
`);
  expect(validationErrors).toBeNull();
});
