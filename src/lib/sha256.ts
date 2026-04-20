const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
  0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

const INITIAL_STATE = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
];

export async function sha256Hex(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
  }
  return sha256HexFallback(bytes);
}

function sha256HexFallback(bytes: Uint8Array) {
  const padded = padMessage(bytes);
  const state = INITIAL_STATE.slice();
  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const base = offset + i * 4;
      w[i] =
        (padded[base] << 24) |
        (padded[base + 1] << 16) |
        (padded[base + 2] << 8) |
        padded[base + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      w[i] = add(
        smallSigma1(w[i - 2]),
        w[i - 7],
        smallSigma0(w[i - 15]),
        w[i - 16],
      );
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let i = 0; i < 64; i += 1) {
      const t1 = add(h, bigSigma1(e), choose(e, f, g), K[i], w[i]);
      const t2 = add(bigSigma0(a), majority(a, b, c));
      h = g;
      g = f;
      f = e;
      e = add(d, t1);
      d = c;
      c = b;
      b = a;
      a = add(t1, t2);
    }

    state[0] = add(state[0], a);
    state[1] = add(state[1], b);
    state[2] = add(state[2], c);
    state[3] = add(state[3], d);
    state[4] = add(state[4], e);
    state[5] = add(state[5], f);
    state[6] = add(state[6], g);
    state[7] = add(state[7], h);
  }

  const output = new Uint8Array(32);
  state.forEach((value, index) => {
    output[index * 4] = value >>> 24;
    output[index * 4 + 1] = (value >>> 16) & 0xff;
    output[index * 4 + 2] = (value >>> 8) & 0xff;
    output[index * 4 + 3] = value & 0xff;
  });
  return bytesToHex(output);
}

function padMessage(bytes: Uint8Array) {
  const bitLength = bytes.length * 8;
  const withOneBit = bytes.length + 1;
  const zeroPadLength = (64 - ((withOneBit + 8) % 64)) % 64;
  const padded = new Uint8Array(withOneBit + zeroPadLength + 8);
  padded.set(bytes, 0);
  padded[bytes.length] = 0x80;

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  const end = padded.length - 8;
  padded[end] = high >>> 24;
  padded[end + 1] = (high >>> 16) & 0xff;
  padded[end + 2] = (high >>> 8) & 0xff;
  padded[end + 3] = high & 0xff;
  padded[end + 4] = low >>> 24;
  padded[end + 5] = (low >>> 16) & 0xff;
  padded[end + 6] = (low >>> 8) & 0xff;
  padded[end + 7] = low & 0xff;
  return padded;
}

function add(...values: number[]) {
  let total = 0;
  for (const value of values) total = (total + value) >>> 0;
  return total;
}

function rotr(value: number, shift: number) {
  return (value >>> shift) | (value << (32 - shift));
}

function choose(x: number, y: number, z: number) {
  return (x & y) ^ (~x & z);
}

function majority(x: number, y: number, z: number) {
  return (x & y) ^ (x & z) ^ (y & z);
}

function bigSigma0(x: number) {
  return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
}

function bigSigma1(x: number) {
  return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
}

function smallSigma0(x: number) {
  return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
}

function smallSigma1(x: number) {
  return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
