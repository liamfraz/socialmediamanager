import sharp from "sharp";

const HASH_SIZE = 8;

export interface HashResult {
  hash: string;
  success: boolean;
  error?: string;
}

export interface SimilarityGroup {
  items: { itemId: string; hash: string; distance: number }[];
}

export async function computeDHash(imagePathOrBuffer: string | Buffer): Promise<HashResult> {
  try {
    const input = typeof imagePathOrBuffer === "string"
      ? sharp(imagePathOrBuffer)
      : sharp(imagePathOrBuffer);

    const pixels = await input
      .greyscale()
      .resize(HASH_SIZE + 1, HASH_SIZE, { fit: "fill" })
      .raw()
      .toBuffer();

    let hash = "";
    for (let y = 0; y < HASH_SIZE; y++) {
      for (let x = 0; x < HASH_SIZE; x++) {
        const left = pixels[y * (HASH_SIZE + 1) + x];
        const right = pixels[y * (HASH_SIZE + 1) + x + 1];
        hash += left < right ? "1" : "0";
      }
    }

    // Convert binary string to hex (process in 4-bit chunks)
    let hexHash = "";
    for (let i = 0; i < hash.length; i += 4) {
      hexHash += parseInt(hash.substring(i, i + 4), 2).toString(16);
    }

    return { hash: hexHash, success: true };
  } catch (error) {
    return {
      hash: "",
      success: false,
      error: error instanceof Error ? error.message : "Hash computation failed",
    };
  }
}

export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 64;

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    // Count bits in 4-bit value
    let bits = xor;
    while (bits > 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  return distance;
}

export function getThresholdForStrictness(strictness: string): number {
  switch (strictness) {
    case "high":
      return 5;
    case "medium":
      return 10;
    case "low":
      return 15;
    default:
      return 10;
  }
}

export function findSimilarGroups(
  items: { id: string; hash: string }[],
  threshold: number
): SimilarityGroup[] {
  const n = items.length;
  if (n < 2) return [];

  // Union-Find
  const parent: Record<string, string> = {};
  const rankMap: Record<string, number> = {};

  function find(x: string): string {
    if (!(x in parent)) {
      parent[x] = x;
      rankMap[x] = 0;
    }
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }

  function union(x: string, y: string) {
    const px = find(x);
    const py = find(y);
    if (px === py) return;
    const rx = rankMap[px] || 0;
    const ry = rankMap[py] || 0;
    if (rx < ry) {
      parent[px] = py;
    } else if (rx > ry) {
      parent[py] = px;
    } else {
      parent[py] = px;
      rankMap[px] = rx + 1;
    }
  }

  const distances: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!items[i].hash || !items[j].hash) continue;
      const dist = hammingDistance(items[i].hash, items[j].hash);
      if (dist <= threshold) {
        union(items[i].id, items[j].id);
        distances[`${items[i].id}:${items[j].id}`] = dist;
      }
    }
  }

  // Group by root
  const groups: Record<string, { id: string; hash: string }[]> = {};
  for (const item of items) {
    if (!item.hash) continue;
    const root = find(item.id);
    if (!groups[root]) {
      groups[root] = [];
    }
    groups[root].push(item);
  }

  const result: SimilarityGroup[] = [];
  for (const root of Object.keys(groups)) {
    const members = groups[root];
    if (members.length < 2) continue;

    const groupItems = members.map((member) => {
      let minDist = 0;
      for (const other of members) {
        if (other.id === member.id) continue;
        const key1 = `${member.id}:${other.id}`;
        const key2 = `${other.id}:${member.id}`;
        const dist = distances[key1] ?? distances[key2] ?? threshold;
        if (minDist === 0 || dist < minDist) {
          minDist = dist;
        }
      }
      return { itemId: member.id, hash: member.hash, distance: minDist };
    });

    result.push({ items: groupItems });
  }

  return result;
}
