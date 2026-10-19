import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function validateVersion(metadata, previousCode = 0) {
  const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!semver.test(metadata.version) || !Number.isSafeInteger(metadata.androidVersionCode) || metadata.androidVersionCode <= previousCode || metadata.androidVersionCode > 2100000000) {
    throw new Error('Release requires a valid version and strictly increasing Android versionCode');
  }
}
export function validateEffectiveVersion(metadata, environment) {
  if ((environment.BILLZEN_VERSION_NAME && environment.BILLZEN_VERSION_NAME !== metadata.version) || (environment.BILLZEN_VERSION_CODE && environment.BILLZEN_VERSION_CODE !== String(metadata.androidVersionCode))) {
    throw new Error('Version environment overrides must match authoritative release metadata');
  }
}
export function validateAlignment(metadata, files) {
  validateVersion(metadata);
  const packageSection = files.cargo.split('[package]')[1]?.split(/^\[/m)[0];
  const cargoVersion = packageSection?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (files.package.version !== metadata.version || files.tauri.version !== metadata.version || cargoVersion !== metadata.version || files.tauri.bundle.android.versionCode !== metadata.androidVersionCode) {
    throw new Error('Release metadata differs across package.json, Cargo.toml and Tauri');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = path => JSON.parse(readFileSync(path, 'utf8'));
  const metadata = json('release/version.json');
  validateEffectiveVersion(metadata, process.env);
  validateAlignment(metadata, {package:json('package.json'),tauri:json('src-tauri/tauri.conf.json'),cargo:readFileSync('src-tauri/Cargo.toml','utf8')});
  validateVersion(metadata, Number(process.env.BILLZEN_PREVIOUS_VERSION_CODE ?? 0));
  console.log(JSON.stringify(metadata));
}
