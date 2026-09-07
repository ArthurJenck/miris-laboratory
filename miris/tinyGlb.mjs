/* A minimal glTF 2.0 binary, written by hand. Offline mode still has to hand
   back a real archive, and shipping six 21MB creature meshes to do it would
   put 129MB in the repo. A cube is a few hundred bytes and exercises the same
   path: it passes the isGlb magic check, unzips, and opens in a viewer. */

const CORNERS = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];

// Two triangles per face, wound counter-clockwise seen from outside.
const FACES = [
  [0, 1, 2], [0, 2, 3], // back
  [5, 4, 7], [5, 7, 6], // front
  [4, 0, 3], [4, 3, 7], // left
  [1, 5, 6], [1, 6, 2], // right
  [3, 2, 6], [3, 6, 7], // top
  [4, 5, 1], [4, 1, 0], // bottom
];

/** GLB chunks are 4-byte aligned; JSON pads with spaces, BIN with zeroes. */
const pad = (buf, filler) => {
  const over = buf.length % 4;
  return over === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - over, filler)]);
};

/**
 * @param {number} scale half-extent of the cube, so six stages can differ.
 * @returns {Buffer} a complete .glb
 */
export function tinyGlb(scale = 1) {
  const positions = Buffer.alloc(CORNERS.length * 3 * 4);
  CORNERS.forEach(([x, y, z], i) => {
    positions.writeFloatLE(x * scale, i * 12);
    positions.writeFloatLE(y * scale, i * 12 + 4);
    positions.writeFloatLE(z * scale, i * 12 + 8);
  });

  const indices = Buffer.alloc(FACES.length * 3 * 2);
  FACES.flat().forEach((v, i) => indices.writeUInt16LE(v, i * 2));

  const bin = pad(Buffer.concat([positions, indices]), 0);

  const json = Buffer.from(
    JSON.stringify({
      asset: { version: "2.0", generator: "miris-workshop offline fixture" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126, // FLOAT
          count: CORNERS.length,
          type: "VEC3",
          // Required on POSITION, and validators reject the file without it.
          min: [-scale, -scale, -scale],
          max: [scale, scale, scale],
        },
        {
          bufferView: 1,
          componentType: 5123, // UNSIGNED_SHORT
          count: FACES.length * 3,
          type: "SCALAR",
        },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.length, target: 34962 },
        { buffer: 0, byteOffset: positions.length, byteLength: indices.length, target: 34963 },
      ],
      buffers: [{ byteLength: bin.length }],
    }),
    "utf8",
  );
  const jsonChunk = pad(json, 0x20);

  const head = Buffer.alloc(12);
  head.write("glTF", 0, "ascii");
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);

  const chunk = (data, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(data.length, 0);
    h.write(type, 4, "ascii");
    return Buffer.concat([h, data]);
  };

  return Buffer.concat([head, chunk(jsonChunk, "JSON"), chunk(bin, "BIN\0")]);
}
