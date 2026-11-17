const major = Number(process.versions.node.split('.')[0]);

if (major < 24) {
  console.error('');
  console.error('Node 24 is required for native commands.');
  console.error(`Current Node: ${process.version}`);
  console.error('Run: nvm use 24');
  console.error('');
  process.exit(1);
}
