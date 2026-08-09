type TreeEntry = {
  path: string;
  sha: string;
  type: string;
  ref?: string;
};

type TreeResponse = {
  tree: TreeEntry[];
  truncated: boolean;
};

type JsDelivrTreeResponse = {
  files: { name: string; hash: string }[];
};

const treeCache = new Map<string, Promise<TreeEntry[]>>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'codex-hook',
    },
  });
  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json() as T;
}

async function tree(repository: string, ref: string, refresh = false): Promise<TreeEntry[]> {
  const key = `${repository}@${ref}`;
  if (!refresh) {
    const cached = treeCache.get(key);
    if (cached) return cached;
  }
  const request = githubTree(repository, ref).catch(() => jsDelivrTree(repository, ref));
  treeCache.set(key, request);
  try {
    return await request;
  } catch (error) {
    treeCache.delete(key);
    throw error;
  }
}

async function bytes(
  repository: string,
  ref: string,
  file: string,
): Promise<Uint8Array> {
  const response = await fetch(`https://raw.githubusercontent.com/${repository}/${ref}/${file}`).catch(() => null);
  if (response?.ok) return new Uint8Array(await response.arrayBuffer());
  const fallback = await fetch(`https://cdn.jsdelivr.net/gh/${repository}@${ref}/${file}`);
  if (fallback.ok) return new Uint8Array(await fallback.arrayBuffer());
  throw new Error(`skill download failed: ${repository}/${file}`);
}

async function githubTree(repository: string, ref: string): Promise<TreeEntry[]> {
  const result = await fetchJson<TreeResponse>(
    `https://api.github.com/repos/${repository}/git/trees/${ref}?recursive=1`,
  );
  if (result.truncated) throw new Error(`github tree truncated: ${repository}`);
  return result.tree.filter((entry) => entry.type === 'blob');
}

async function jsDelivrTree(repository: string, ref: string): Promise<TreeEntry[]> {
  const resolvedRef = await gitRef(repository, ref).catch(() => ref);
  const result = await fetchJson<JsDelivrTreeResponse>(
    `https://data.jsdelivr.com/v1/package/gh/${repository}@${resolvedRef}/flat`,
  );
  return result.files.map(({ name, hash }) => ({ path: name.slice(1), sha: hash, type: 'blob', ref: resolvedRef }));
}

async function gitRef(repository: string, ref: string): Promise<string> {
  const response = await fetch(
    `https://github.com/${repository}.git/info/refs?service=git-upload-pack`,
    { headers: { 'user-agent': 'codex-hook' } },
  );
  if (!response.ok) throw new Error(`git ref request failed: ${response.status}`);
  const branch = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = (await response.text()).match(new RegExp(`([\\da-f]{40}) refs/heads/${branch}(?:\\0|\\n)`));
  if (!match) throw new Error(`git ref not found: ${repository}@${ref}`);
  return match[1];
}

export { bytes, tree };
export type { TreeEntry };
