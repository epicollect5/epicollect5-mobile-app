const major = Number(process.versions.node.split('.')[0]);

if (major < 22) {
  console.error('');
  console.error('Node 22 is required for native commands.');
  console.error(`Current Node: ${process.version}`);
  console.error('Run: nvm use 22');
  console.error('');
  process.exit(1);
}
