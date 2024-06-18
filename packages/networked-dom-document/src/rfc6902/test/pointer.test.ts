import { Pointer } from "../pointer";

const example = { bool: false, arr: [10, 20, 30], obj: { a: "A", b: "B" } };
describe("Pointer", () => {
  test("Pointer#get bool", () => {
    expect(Pointer.fromJSON("/bool").get(example)).toEqual(false); // should get bool value
  });
  test("Pointer#get array", () => {
    expect(Pointer.fromJSON("/arr/1").get(example)).toEqual(20); //should get array value
  });
  test("Pointer#get object", () => {
    expect(Pointer.fromJSON("/obj/b").get(example)).toEqual("B"); // should get object value
  });

  test("Pointer#set bool", () => {
    const input = { bool: true };
    Pointer.fromJSON("/bool").set(input, false);
    expect(input.bool).toEqual(false); // should set bool value in-place
  });

  test("Pointer#set array middle", () => {
    const input: any = { arr: ["10", "20", "30"] };
    Pointer.fromJSON("/arr/1").set(input, 0);
    expect(input.arr[1]).toEqual(0); // should set array value in-place
  });

  test("Pointer#set array beyond", () => {
    const input: any = { arr: ["10", "20", "30"] };
    Pointer.fromJSON("/arr/3").set(input, 40);
    expect(input.arr[3]).toEqual(40); // should set array value in-place
  });

  test("Pointer#set object existing", () => {
    const input = { obj: { a: "A", b: "B" } };
    Pointer.fromJSON("/obj/b").set(input, "BBB");
    expect(input.obj.b).toEqual("BBB"); // should set object value in-place
  });

  test("Pointer#set object new", () => {
    const input: any = { obj: { a: "A", b: "B" } };
    Pointer.fromJSON("/obj/c").set(input, "C");
    expect(input.obj.c).toEqual("C"); // should add object value in-place
  });
});
