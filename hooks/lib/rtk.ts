function requiresRtk(command: unknown) {
  return typeof command === 'string' && !/^\s*rtk(?:\s|$)/i.test(command);
}

export { requiresRtk };
