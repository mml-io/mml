import {
  BufferReader,
  BufferWriter,
  encodeServerMessage,
  NetworkedDOMV02ServerMessage,
} from "@mml-io/networked-dom-protocol";
import { decodeServerMessages } from "@mml-io/networked-dom-protocol";
import Benchmark from "benchmark";

import { prepareData } from "./prepare-data.js";

const data = prepareData(1000);

const encodedData = data.map((message) => {
  const writer = new BufferWriter(256);
  encodeServerMessage(message, writer);
  return writer.getBuffer();
});
const encodedJSON = data.map((message) => JSON.stringify(message));

const suite = new Benchmark.Suite();
suite
  .add("Binary", function () {
    let totalLength = 0;
    for (const message of encodedData) {
      const bufferReader = new BufferReader(message);
      const decoded = decodeServerMessages(bufferReader);
      totalLength += (decoded[0] as NetworkedDOMV02ServerMessage).type.length;
    }
    if (totalLength <= 0) {
      throw new Error("Invalid total length");
    }
  })
  .add("JSON", function () {
    let totalLength = 0;
    for (const message of encodedJSON) {
      const decoded = JSON.parse(message);
      totalLength += decoded.type.length;
    }
    if (totalLength <= 0) {
      throw new Error("Invalid total length");
    }
  })
  // add listeners
  .on("cycle", (event: Benchmark.Event) => {
    console.log(String(event.target));
  })
  .on("complete", () => {
    console.log(`Fastest is ${suite.filter("fastest").map("name")}`);
  })
  // run async
  .run({ async: true });
