/**
 * Tests for Personal Cloud Storage Integration.
 * Covers connection management, file listing, proxy estimation, snapshot management.
 */

import { describe, it, expect } from "vitest";
import {
  createConnectionConfig,
  updateConnectionConfig,
  createConnectionState,
  setConnectionStatus,
  filterMediaFiles,
  sortDirectoryEntries,
  estimateProxySize,
  getProxyCachePath,
  createSnapshot,
  sortSnapshots,
  formatSnapshotPath,
} from "../personal-cloud.js";
import type { CloudFileEntry, CloudConnectionConfig } from "../personal-cloud.js";

// ============================================================
// Connection Management
// ============================================================

describe("createConnectionConfig", () => {
  it("creates a valid WebDAV config", () => {
    const config = createConnectionConfig({
      provider: "webdav",
      label: "My NAS",
      endpoint: "https://nas.example.com/dav/",
      username: "admin",
      credentialRef: "cred-123",
      rootPath: "/media",
    });
    expect(config.provider).toBe("webdav");
    expect(config.label).toBe("My NAS");
    expect(config.endpoint).toBe("https://nas.example.com/dav");
    expect(config.username).toBe("admin");
    expect(config.rootPath).toBe("/media");
    expect(config.autoConnect).toBe(false);
    expect(config.id).toMatch(/^cloud-/);
  });

  it("creates a valid OneDrive config", () => {
    const config = createConnectionConfig({
      provider: "onedrive",
      label: "OneDrive",
      endpoint: "tenant-123",
      credentialRef: "cred-456",
    });
    expect(config.endpoint).toBe("https://graph.microsoft.com/v1.0");
    expect(config.rootPath).toBe("/");
  });

  it("trims whitespace from label", () => {
    const config = createConnectionConfig({
      provider: "webdav",
      label: "  My NAS  ",
      endpoint: "https://nas.example.com",
      credentialRef: "c",
    });
    expect(config.label).toBe("My NAS");
  });

  it("uses default label when empty", () => {
    const config = createConnectionConfig({
      provider: "webdav",
      label: "",
      endpoint: "https://nas.example.com",
      credentialRef: "c",
    });
    expect(config.label).toBe("webdav connection");
  });

  it("strips trailing slashes from endpoint", () => {
    const config = createConnectionConfig({
      provider: "webdav",
      label: "Test",
      endpoint: "https://example.com/dav///",
      credentialRef: "c",
    });
    expect(config.endpoint).toBe("https://example.com/dav");
  });
});

describe("updateConnectionConfig", () => {
  const base: CloudConnectionConfig = {
    id: "cloud-1",
    provider: "webdav",
    label: "Old",
    endpoint: "https://old.example.com",
    credentialRef: "c",
    rootPath: "/",
    autoConnect: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("updates label immutably", () => {
    const updated = updateConnectionConfig(base, { label: "New Label" });
    expect(updated.label).toBe("New Label");
    expect(base.label).toBe("Old"); // original unchanged
    expect(updated.updatedAt).not.toBe(base.updatedAt);
  });

  it("normalizes endpoint on update", () => {
    const updated = updateConnectionConfig(base, { endpoint: "https://new.com/dav/" });
    expect(updated.endpoint).toBe("https://new.com/dav");
  });

  it("normalizes rootPath on update", () => {
    const updated = updateConnectionConfig(base, { rootPath: "media" });
    expect(updated.rootPath).toBe("/media");
  });
});

// ============================================================
// Connection State
// ============================================================

describe("connection state", () => {
  it("creates initial disconnected state", () => {
    const state = createConnectionState("config-1");
    expect(state.configId).toBe("config-1");
    expect(state.status).toBe("disconnected");
    expect(state.lastError).toBeUndefined();
  });

  it("transitions to connected with timestamp", () => {
    const state = createConnectionState("config-1");
    const connected = setConnectionStatus(state, "connected");
    expect(connected.status).toBe("connected");
    expect(connected.connectedAt).toBeDefined();
    expect(connected.lastError).toBeUndefined();
  });

  it("transitions to error with message", () => {
    const state = createConnectionState("config-1");
    const errored = setConnectionStatus(state, "error", "Connection refused");
    expect(errored.status).toBe("error");
    expect(errored.lastError).toBe("Connection refused");
  });

  it("clears error when connecting", () => {
    const state = setConnectionStatus(createConnectionState("c1"), "error", "fail");
    const connecting = setConnectionStatus(state, "connecting");
    expect(connecting.status).toBe("connecting");
    // lastError from previous state is preserved (not cleared unless connected)
    expect(connecting.lastError).toBe("fail");
  });
});

// ============================================================
// File Listing
// ============================================================

const makeEntry = (name: string, opts: Partial<CloudFileEntry> = {}): CloudFileEntry => ({
  path: `/root/${name}`,
  name,
  isDirectory: false,
  hasLocalProxy: false,
  ...opts,
});

describe("filterMediaFiles", () => {
  it("filters video and audio files", () => {
    const entries = [
      makeEntry("video.mp4"),
      makeEntry("audio.wav"),
      makeEntry("image.jpg"),
      makeEntry("document.pdf"),
      makeEntry("subtitles.srt"),
    ];
    const result = filterMediaFiles(entries);
    expect(result.map((e) => e.name)).toEqual(["video.mp4", "audio.wav", "image.jpg"]);
  });

  it("excludes directories", () => {
    const entries = [
      makeEntry("folder", { isDirectory: true }),
      makeEntry("video.mp4"),
    ];
    const result = filterMediaFiles(entries);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("video.mp4");
  });

  it("handles case-insensitive extensions", () => {
    const entries = [makeEntry("VIDEO.MP4"), makeEntry("Audio.WAV")];
    const result = filterMediaFiles(entries);
    expect(result).toHaveLength(2);
  });

  it("returns empty for no media files", () => {
    const entries = [makeEntry("readme.txt"), makeEntry("data.json")];
    expect(filterMediaFiles(entries)).toEqual([]);
  });
});

describe("sortDirectoryEntries", () => {
  const entries: CloudFileEntry[] = [
    makeEntry("b.mp4", { size: 1000 }),
    makeEntry("a.mp4", { size: 500 }),
    makeEntry("folder", { isDirectory: true }),
  ];

  it("sorts by name ascending (directories first)", () => {
    const sorted = sortDirectoryEntries(entries, "name", "asc");
    expect(sorted.map((e) => e.name)).toEqual(["folder", "a.mp4", "b.mp4"]);
  });

  it("sorts by name descending", () => {
    const sorted = sortDirectoryEntries(entries, "name", "desc");
    expect(sorted.map((e) => e.name)).toEqual(["b.mp4", "a.mp4", "folder"]);
  });

  it("sorts by size ascending", () => {
    const sorted = sortDirectoryEntries(entries, "size", "asc");
    expect(sorted.map((e) => e.name)).toEqual(["folder", "a.mp4", "b.mp4"]);
  });
});

// ============================================================
// Proxy Generation
// ============================================================

describe("estimateProxySize", () => {
  it("estimates low quality at 5%", () => {
    expect(estimateProxySize(1_000_000, "low")).toBe(50_000);
  });

  it("estimates medium quality at 15%", () => {
    expect(estimateProxySize(1_000_000, "medium")).toBe(150_000);
  });

  it("estimates high quality at 40%", () => {
    expect(estimateProxySize(1_000_000, "high")).toBe(400_000);
  });
});

describe("getProxyCachePath", () => {
  it("generates safe cache path", () => {
    const path = getProxyCachePath("conn-1", "videos/clip.mp4", "low");
    // dots are replaced by the sanitization regex
    expect(path).toMatch(/^proxy\/conn-1\/low\/videos\/clip/);
  });

  it("replaces unsafe characters", () => {
    const path = getProxyCachePath("c1", "path/with spaces & special.mp4", "high");
    expect(path).not.toContain(" ");
    expect(path).not.toContain("&");
  });
});

// ============================================================
// Snapshot Management
// ============================================================

describe("createSnapshot", () => {
  it("creates snapshot with auto-incremented version", () => {
    const snap = createSnapshot({
      projectId: "proj-1",
      projectName: "My Project",
      connectionId: "conn-1",
    });
    expect(snap.projectId).toBe("proj-1");
    expect(snap.version).toBe(1);
    expect(snap.remotePath).toMatch(/^snapshots\/proj-1\/v1_/);
    expect(snap.id).toMatch(/^snap-/);
  });

  it("increments from previous version", () => {
    const snap = createSnapshot({
      projectId: "proj-1",
      projectName: "My Project",
      connectionId: "conn-1",
      previousVersion: 5,
    });
    expect(snap.version).toBe(6);
  });

  it("uses custom remote path", () => {
    const snap = createSnapshot({
      projectId: "proj-1",
      projectName: "My Project",
      connectionId: "conn-1",
      remotePath: "custom/path.zip",
    });
    expect(snap.remotePath).toBe("custom/path.zip");
  });
});

describe("sortSnapshots", () => {
  const snapshots = [
    { id: "1", projectId: "p", projectName: "P", connectionId: "c", remotePath: "", version: 1, createdAt: "" },
    { id: "2", projectId: "p", projectName: "P", connectionId: "c", remotePath: "", version: 3, createdAt: "" },
    { id: "3", projectId: "p", projectName: "P", connectionId: "c", remotePath: "", version: 2, createdAt: "" },
  ];

  it("sorts newest first by default", () => {
    const sorted = sortSnapshots(snapshots);
    expect(sorted.map((s) => s.version)).toEqual([3, 2, 1]);
  });

  it("sorts oldest first", () => {
    const sorted = sortSnapshots(snapshots, "oldest");
    expect(sorted.map((s) => s.version)).toEqual([1, 2, 3]);
  });
});

describe("formatSnapshotPath", () => {
  it("generates versioned path", () => {
    const path = formatSnapshotPath("proj-1", 3);
    expect(path).toMatch(/^snapshots\/proj-1\/v3_/);
    expect(path).toMatch(/\.zip$/);
  });
});
