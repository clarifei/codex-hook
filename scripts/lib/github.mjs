async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`github request failed: ${response.status}`);
  return response.json();
}

async function tree(repository, ref) {
  const result = await json(`https://api.github.com/repos/${repository}/git/trees/${ref}?recursive=1`);
  if (result.truncated) throw new Error(`github tree truncated: ${repository}`);
  return result.tree.filter((entry) => entry.type === 'blob');
}

async function bytes(repository, ref, file) {
  const response = await fetch(`https://raw.githubusercontent.com/${repository}/${ref}/${file}`);
  if (!response.ok) throw new Error(`skill download failed: ${repository}/${file}`);
  return Buffer.from(await response.arrayBuffer());
}

export { bytes, tree };
