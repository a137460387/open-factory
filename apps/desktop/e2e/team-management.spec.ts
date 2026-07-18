/**
 * 团队管理 E2E 测试
 *
 * 测试团队管理工作流：
 * 1. 打开团队管理面板
 * 2. 创建团队
 * 3. 邀请成员
 * 4. 管理成员角色
 * 5. 项目共享
 * 6. 审计日志
 */
import { expect, test } from './fixtures';

test.describe('团队管理', () => {
  test('打开团队管理面板', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 通过工具菜单打开团队管理面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-team-management-menu-item').click();

    // 团队管理面板应可见
    await expect(page.getByTestId('team-management-panel')).toBeVisible();
  });

  test('显示团队成员列表', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 模拟团队数据
    await page.evaluate(() => {
      window.__E2E_ACTIONS__!.simulateTeamData?.({
        team: {
          id: 'team-1',
          name: '测试团队',
          description: '这是一个测试团队',
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: {
            allowMemberInvite: true,
            allowProjectCreation: true,
            defaultProjectPermission: 'view',
            maxMembers: 50,
            maxProjects: 100,
            requireApprovalForJoin: false,
            enableAuditLog: true,
            syncEnabled: true,
          },
          metadata: {
            memberCount: 3,
            projectCount: 2,
            lastActivityAt: new Date().toISOString(),
            storageUsed: 0,
            storageLimit: 1073741824,
          },
        },
        members: [
          {
            userId: 'user-1',
            userName: '管理员',
            role: 'owner',
            status: 'active',
            joinedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            permissions: {
              canCreateProjects: true,
              canInviteMembers: true,
              canManageRoles: true,
              canDeleteProjects: true,
              canExportProjects: true,
              canViewAuditLog: true,
            },
          },
          {
            userId: 'user-2',
            userName: '编辑者',
            role: 'member',
            status: 'active',
            joinedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            permissions: {
              canCreateProjects: true,
              canInviteMembers: false,
              canManageRoles: false,
              canDeleteProjects: false,
              canExportProjects: true,
              canViewAuditLog: false,
            },
          },
        ],
      });
    });

    // 打开团队管理面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-team-management-menu-item').click();

    // 验证成员列表
    await expect(page.getByTestId('team-member-item')).toHaveCount(2);
  });

  test('邀请新成员', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开团队管理面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-team-management-menu-item').click();

    // 点击邀请按钮
    await page.getByTestId('team-invite-button').click();

    // 填写邀请信息
    await page.getByTestId('team-invite-email-input').fill('newuser@example.com');
    await page.getByTestId('team-invite-role-select').selectOption('member');

    // 发送邀请
    await page.getByTestId('team-invite-send-button').click();

    // 验证邀请成功提示
    await expect(page.getByTestId('team-invite-success-toast')).toBeVisible();
  });

  test('切换成员角色', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开团队管理面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-team-management-menu-item').click();

    // 点击成员的操作菜单
    await page.getByTestId('team-member-menu-user-2').click();

    // 选择更改角色为管理员
    await page.getByTestId('team-member-role-admin').click();

    // 验证角色更新成功提示
    await expect(page.getByTestId('team-role-change-toast')).toBeVisible();
  });

  test('显示审计日志', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开团队管理面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-team-management-menu-item').click();

    // 切换到审计日志标签
    await page.getByTestId('team-tab-audit').click();

    // 验证审计日志区域可见
    await expect(page.getByTestId('team-audit-log-section')).toBeVisible();
  });

  test('显示团队设置', async ({ page, toolbar }) => {
    await toolbar.goto();
    await toolbar.waitForE2eActions();

    // 打开团队管理面板
    await page.getByTestId('toolbar-tools-menu-button').click();
    await page.getByTestId('toolbar-tools-team-management-menu-item').click();

    // 切换到设置标签
    await page.getByTestId('team-tab-settings').click();

    // 验证设置区域可见
    await expect(page.getByTestId('team-settings-section')).toBeVisible();
    await expect(page.getByTestId('team-settings-name-input')).toBeVisible();
  });
});
