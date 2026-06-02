'use strict';

/**
 * Custom electron-builder signer that uses Azure Trusted Signing
 * via the SignTool + Azure.CodeSigning Dlib package.
 *
 * Required env vars:
 *   AZURE_TENANT_ID
 *   AZURE_CLIENT_ID
 *   AZURE_CLIENT_SECRET
 *   AZURE_TRUSTED_SIGNING_ENDPOINT   (e.g. https://eus.codesigning.azure.net)
 *   AZURE_TRUSTED_SIGNING_ACCOUNT
 *   AZURE_TRUSTED_SIGNING_PROFILE
 *
 * Optional:
 *   AZURE_SIGNTOOL_PATH   - override path to signtool.exe
 *   AZURE_DLIB_PATH       - override path to Azure.CodeSigning.Dlib.dll
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

exports.default = async function sign(configuration) {
  const filePath = configuration.path;
  if (!filePath) {
    throw new Error('azure-sign: no file path supplied by electron-builder');
  }

  // Skip on non-Windows platforms (defensive — should only run on win build).
  if (process.platform !== 'win32') {
    console.log(`[azure-sign] Skipping ${filePath} — not running on Windows.`);
    return;
  }

  const required = [
    'AZURE_TENANT_ID',
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_TRUSTED_SIGNING_ENDPOINT',
    'AZURE_TRUSTED_SIGNING_ACCOUNT',
    'AZURE_TRUSTED_SIGNING_PROFILE',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    console.warn(
      `[azure-sign] Skipping signing for ${filePath} — missing env vars: ${missing.join(', ')}`
    );
    return;
  }

  const signtool = process.env.AZURE_SIGNTOOL_PATH || resolveSigntool();
  const dlib = process.env.AZURE_DLIB_PATH || resolveDlib();

  // Write metadata JSON for the Azure Trusted Signing dlib.
  const metadata = {
    Endpoint: process.env.AZURE_TRUSTED_SIGNING_ENDPOINT,
    CodeSigningAccountName: process.env.AZURE_TRUSTED_SIGNING_ACCOUNT,
    CertificateProfileName: process.env.AZURE_TRUSTED_SIGNING_PROFILE,
  };

  const metadataFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'azure-sign-')),
    'metadata.json'
  );
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf8');

  const args = [
    'sign',
    '/v',
    '/debug',
    '/fd', 'SHA256',
    '/tr', 'http://timestamp.acs.microsoft.com',
    '/td', 'SHA256',
    '/dlib', dlib,
    '/dmdf', metadataFile,
    filePath,
  ];

  console.log(`[azure-sign] Signing ${filePath} with Azure Trusted Signing...`);
  try {
    execFileSync(signtool, args, { stdio: 'inherit' });
    console.log(`[azure-sign] Signed ${filePath}`);
  } finally {
    try {
      fs.rmSync(path.dirname(metadataFile), { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }
};

function resolveSigntool() {
  // Common SDK locations — newest first.
  const sdkRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (fs.existsSync(sdkRoot)) {
    const versions = fs
      .readdirSync(sdkRoot)
      .filter((name) => /^\d+\.\d+\.\d+\.\d+$/.test(name))
      .sort()
      .reverse();
    for (const version of versions) {
      const candidate = path.join(sdkRoot, version, 'x64', 'signtool.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  // Fall back to PATH lookup.
  return 'signtool.exe';
}

function resolveDlib() {
  // Installed by the workflow via `dotnet tool` or NuGet.
  const fromEnv = process.env.AZURE_DLIB_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [
    path.join(process.cwd(), 'azure-trusted-signing', 'bin', 'x64', 'Azure.CodeSigning.Dlib.dll'),
    path.join(process.env.USERPROFILE || '', '.nuget', 'packages', 'microsoft.trusted.signing.client'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      // If a NuGet package root, walk down to find the dll.
      if (candidate.endsWith('microsoft.trusted.signing.client')) {
        const dll = findFile(candidate, 'Azure.CodeSigning.Dlib.dll');
        if (dll) return dll;
      } else {
        return candidate;
      }
    }
  }
  throw new Error(
    '[azure-sign] Could not locate Azure.CodeSigning.Dlib.dll — set AZURE_DLIB_PATH or install the Microsoft.Trusted.Signing.Client NuGet package.'
  );
}

function findFile(root, name) {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name === name) {
        return full;
      }
    }
  }
  return null;
}
