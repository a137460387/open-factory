/**
 * Plugin UI API
 *
 * Provides plugins with UI capabilities: panels, dialogs,
 * menus, notifications, and custom React components.
 */

// ─── UI API Types ────────────────────────────────────────────

export type UIPanelPosition = 'left' | 'right' | 'bottom' | 'floating';

export interface UIPanelOptions {
  id: string;
  title: string;
  position: UIPanelPosition;
  width?: number;
  height?: number;
  resizable?: boolean;
  content: string; // HTML content or component reference
}

export interface UIDialogOptions {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'confirm';
  buttons?: string[];
  defaultButton?: number;
}

export interface UIToastOptions {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

export interface PluginUIAPI {
  /** Register a side panel */
  registerPanel(options: UIPanelOptions): Promise<string>;
  /** Remove a panel */
  removePanel(panelId: string): Promise<void>;
  /** Show a dialog */
  showDialog(options: UIDialogOptions): Promise<number>;
  /** Show a toast notification */
  showToast(options: UIToastOptions): Promise<void>;
  /** Register a menu item */
  registerMenuItem(item: {
    id: string;
    label: string;
    parentId?: string;
    shortcut?: string;
    onClick: () => void;
  }): Promise<void>;
  /** Remove a menu item */
  removeMenuItem(itemId: string): Promise<void>;
  /** Set the plugin's status bar text */
  setStatusBar(text: string): Promise<void>;
}

// ─── UI API Implementation ────────────────────────────────────────────

export class PluginUIAPIImpl implements PluginUIAPI {
  private panels = new Map<string, UIPanelOptions>();
  private menuItems = new Map<string, { id: string; label: string; parentId?: string; shortcut?: string; onClick: () => void }>();
  private statusBarText = '';

  async registerPanel(options: UIPanelOptions): Promise<string> {
    const panelId = options.id;
    this.panels.set(panelId, options);
    return panelId;
  }

  async removePanel(panelId: string): Promise<void> {
    if (!this.panels.has(panelId)) {
      throw new Error(`Panel ${panelId} not found`);
    }
    this.panels.delete(panelId);
  }

  async showDialog(options: UIDialogOptions): Promise<number> {
    void options;
    // In real implementation, this would open a Tauri dialog
    return 0; // Default button index
  }

  async showToast(options: UIToastOptions): Promise<void> {
    void options;
    // In real implementation, this would dispatch to toast store
  }

  async registerMenuItem(item: {
    id: string;
    label: string;
    parentId?: string;
    shortcut?: string;
    onClick: () => void;
  }): Promise<void> {
    this.menuItems.set(item.id, item);
  }

  async removeMenuItem(itemId: string): Promise<void> {
    if (!this.menuItems.has(itemId)) {
      throw new Error(`Menu item ${itemId} not found`);
    }
    this.menuItems.delete(itemId);
  }

  async setStatusBar(text: string): Promise<void> {
    this.statusBarText = text;
  }

  /** Get registered panels (for host integration) */
  getPanels(): UIPanelOptions[] {
    return Array.from(this.panels.values());
  }

  /** Get registered menu items (for host integration) */
  getMenuItems() {
    return Array.from(this.menuItems.values());
  }
}
