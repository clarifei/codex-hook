type TreeEntry = {
  path: string;
  sha: string;
  type: string;
};

type TreeResponse = {
  tree: TreeEntry[];
  truncated: boolean;
};

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`github request failed: ${response.status}`);
  }
  return await response.json() as T;
}

async function tree(repository: string, ref: string): Promise<TreeEntry[]> {
  const result = await json<TreeResponse>(
    `https://api.github.com/repos/${repository}/git/trees/${ref}?recursive=1`,
  );
  if (result.truncated) throw new Error(`github tree truncated: ${repository}`);
  return result.tree.filter((entry) => entry.type === 'blob');
}

async function bytes(
  repository: string,
  ref: string,
  file: string,
): Promise<Uint8Array> {
  const response = await fetch(
    `https://raw.githubusercontent.com/${repository}/${ref}/${file}`,
  );
  if (!response.ok) {
    throw new Error(`skill download failed: ${repository}/${file}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export { bytes, tree };
export type { TreeEntry };
