# Networked DOM Protocol Benchmarks

This directory contains a set of benchmarks for the Networked DOM Protocol encoding and decoding compared with JSON.

As of writing the benchmarks show that the binary encoding is faster and smaller than JSON on a test data set.

Notes:
- The test data set uses expressive key names which are therefore included in the JSON output (field names are not included in the binary encoding).
- The test data set does not use multi-byte characters which is more representative of the data that the protocol is used for. (However the binary encoding is still likely to be faster even in this case).

## Encoding Results

```
Ran on Node v20.11.1 on Apple M1 Max 16" MacBook Pro

Binary x 947 ops/sec ±3.68% (92 runs sampled)
JSON x 317 ops/sec ±0.52% (91 runs sampled)
Fastest is Binary
Binary byte length : 229153
JSON byte length   : 703303
Binary is 0.3258 the length of JSON
JSON is 3.0691 the length of Binary
```

## Decoding Results

```
Ran on Node v20.11.1 on Apple M1 Max 16" MacBook Pro

Binary x 568 ops/sec ±0.40% (92 runs sampled)
JSON x 245 ops/sec ±0.33% (90 runs sampled)
Fastest is Binary
```
