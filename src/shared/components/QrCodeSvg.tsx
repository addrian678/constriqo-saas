type QrCodeSvgProps = {
  value: string;
  size?: number;
  title?: string;
};

const QR_VERSION = 4;
const QR_SIZE = 33;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;
const FORMAT_BITS_L_MASK_0 = 0b111011111000100;

export function QrCodeSvg({ value, size = 96, title = "Codigo QR" }: QrCodeSvgProps) {
  const modules = createQrModules(value);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} role="img" aria-label={title} shapeRendering="crispEdges">
      <title>{title}</title>
      <rect width={QR_SIZE} height={QR_SIZE} fill="#ffffff" />
      {modules.map((row, y) =>
        row.map((dark, x) => (dark ? <rect x={x} y={y} width={1} height={1} fill="#111827" key={`${x}-${y}`} /> : null)),
      )}
    </svg>
  );
}

function createQrModules(value: string) {
  const bytes = encodeValue(value);
  const dataCodewords = buildDataCodewords(bytes);
  const ecc = reedSolomonRemainder(dataCodewords, ECC_CODEWORDS);
  const allCodewords = dataCodewords.concat(ecc);
  const modules = Array.from({ length: QR_SIZE }, () => Array.from({ length: QR_SIZE }, () => false));
  const reserved = Array.from({ length: QR_SIZE }, () => Array.from({ length: QR_SIZE }, () => false));

  drawFunctionPatterns(modules, reserved);
  drawCodewords(modules, reserved, allCodewords);
  drawFormatBits(modules, reserved);

  return modules;
}

function encodeValue(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length <= 78) {
    return bytes;
  }
  return Array.from(new TextEncoder().encode(value.slice(0, 78)));
}

function buildDataCodewords(bytes: number[]) {
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }
  const maxBits = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0xec; codewords.length < DATA_CODEWORDS; pad ^= 0xfd) {
    codewords.push(pad);
  }
  return codewords;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function drawFunctionPatterns(modules: boolean[][], reserved: boolean[][]) {
  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, QR_SIZE - 7, 0);
  drawFinder(modules, reserved, 0, QR_SIZE - 7);
  drawAlignment(modules, reserved, 26, 26);

  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    setModule(modules, reserved, 6, i, i % 2 === 0);
    setModule(modules, reserved, i, 6, i % 2 === 0);
  }

  setModule(modules, reserved, 8, QR_VERSION * 4 + 9, true);
  reserveFormatAreas(reserved);
}

function drawFinder(modules: boolean[][], reserved: boolean[][], left: number, top: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const xx = left + x;
      const yy = top + y;
      if (xx < 0 || xx >= QR_SIZE || yy < 0 || yy >= QR_SIZE) {
        continue;
      }
      const dark = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      setModule(modules, reserved, xx, yy, dark);
    }
  }
}

function drawAlignment(modules: boolean[][], reserved: boolean[][], centerX: number, centerY: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1;
      setModule(modules, reserved, centerX + x, centerY + y, dark);
    }
  }
}

function reserveFormatAreas(reserved: boolean[][]) {
  for (let i = 0; i <= 8; i += 1) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][QR_SIZE - 1 - i] = true;
  }
  for (let i = 0; i < 7; i += 1) {
    reserved[QR_SIZE - 1 - i][8] = true;
  }
}

function drawCodewords(modules: boolean[][], reserved: boolean[][], codewords: number[]) {
  const bits = codewords.flatMap((codeword) => Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }
    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const y = upward ? QR_SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (reserved[y][x]) {
          continue;
        }
        const bit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        const masked = bit !== ((x + y) % 2 === 0);
        modules[y][x] = masked;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function drawFormatBits(modules: boolean[][], reserved: boolean[][]) {
  for (let i = 0; i <= 5; i += 1) {
    setModule(modules, reserved, 8, i, getBit(FORMAT_BITS_L_MASK_0, i));
  }
  setModule(modules, reserved, 8, 7, getBit(FORMAT_BITS_L_MASK_0, 6));
  setModule(modules, reserved, 8, 8, getBit(FORMAT_BITS_L_MASK_0, 7));
  setModule(modules, reserved, 7, 8, getBit(FORMAT_BITS_L_MASK_0, 8));
  for (let i = 9; i < 15; i += 1) {
    setModule(modules, reserved, 14 - i, 8, getBit(FORMAT_BITS_L_MASK_0, i));
  }
  for (let i = 0; i < 8; i += 1) {
    setModule(modules, reserved, QR_SIZE - 1 - i, 8, getBit(FORMAT_BITS_L_MASK_0, i));
  }
  for (let i = 8; i < 15; i += 1) {
    setModule(modules, reserved, 8, QR_SIZE - 15 + i, getBit(FORMAT_BITS_L_MASK_0, i));
  }
}

function setModule(modules: boolean[][], reserved: boolean[][], x: number, y: number, dark: boolean) {
  modules[y][x] = dark;
  reserved[y][x] = true;
}

function getBit(value: number, index: number) {
  return ((value >>> index) & 1) !== 0;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const result = data.concat(Array.from({ length: degree }, () => 0));
  for (let i = 0; i < data.length; i += 1) {
    const coefficient = result[i];
    if (coefficient === 0) {
      continue;
    }
    for (let j = 0; j < generator.length; j += 1) {
      result[i + j + 1] ^= gfMultiply(generator[j], coefficient);
    }
  }
  return result.slice(data.length);
}

function reedSolomonGenerator(degree: number) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    result = polynomialMultiply(result, [1, gfPow(2, i)]);
  }
  return result.slice(1);
}

function polynomialMultiply(left: number[], right: number[]) {
  const result = Array.from({ length: left.length + right.length - 1 }, () => 0);
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      result[i + j] ^= gfMultiply(left[i], right[j]);
    }
  }
  return result;
}

function gfPow(value: number, power: number) {
  let result = 1;
  for (let i = 0; i < power; i += 1) {
    result = gfMultiply(result, value);
  }
  return result;
}

function gfMultiply(left: number, right: number) {
  let x = left;
  let y = right;
  let result = 0;
  while (y !== 0) {
    if ((y & 1) !== 0) {
      result ^= x;
    }
    x <<= 1;
    if ((x & 0x100) !== 0) {
      x ^= 0x11d;
    }
    y >>>= 1;
  }
  return result & 0xff;
}
