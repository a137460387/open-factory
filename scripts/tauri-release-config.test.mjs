import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../apps/desktop/src-tauri/tauri.conf.json', import.meta.url), 'utf8'));

describe('Tauri release configuration', () => {
  it('declares macOS app and dmg bundle targets with signing placeholders', () => {
    expect(config.bundle.targets).toEqual(expect.arrayContaining(['app', 'dmg']));
    expect(config.bundle.macOS).toMatchObject({
      signingIdentity: null,
      providerShortName: null,
      hardenedRuntime: true
    });
  });

  it('declares Linux deb and AppImage bundle targets', () => {
    expect(config.bundle.targets).toEqual(expect.arrayContaining(['deb', 'appimage']));
    expect(config.bundle.linux.appimage.bundleMediaFramework).toBe(true);
  });

  it('declares WebKitGTK and OpenSSL deb dependencies', () => {
    expect(config.bundle.linux.deb.depends).toEqual(expect.arrayContaining(['libwebkit2gtk-4.1-0', 'libssl3']));
  });

  it('declares the updater endpoint URL', () => {
    expect(config.plugins.updater.endpoints).toEqual(['https://github.com/open-factory/open-factory/releases/latest/download/latest.json']);
    expect(config.plugins.updater.pubkey).toEqual(expect.any(String));
  });
});
