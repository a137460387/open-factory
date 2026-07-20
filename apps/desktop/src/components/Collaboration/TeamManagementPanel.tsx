/**
 * 团队管理面板组件
 * 提供团队创建、成员管理、项目共享等功能的UI界面
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  UserPlus,
  Settings,
  Shield,
  FolderOpen,
  Activity,
  MoreVertical,
  Mail,
  Crown,
  Edit3,
  Eye,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TeamManager,
  createTeamManager,
  type Team,
  type TeamMember,
  type TeamRole,
  type TeamInvitation,
  type TeamProjectShare,
  type TeamAuditLog,
} from '@open-factory/editor-core/collaboration/team/team-management';

// ==================== 类型定义 ====================

interface TeamManagementPanelProps {
  teamManager?: TeamManager;
  currentUserId: string;
  currentUserName: string;
  onTeamUpdate?: (team: Team) => void;
  onMemberUpdate?: (members: TeamMember[]) => void;
}

type TabType = 'members' | 'invitations' | 'projects' | 'settings' | 'audit';

// ==================== 角色配置 ====================

const ROLE_CONFIG: Record<TeamRole, { label: string; icon: React.ReactNode; color: string }> = {
  owner: {
    label: '所有者',
    icon: <Crown className="w-4 h-4" />,
    color: 'text-yellow-500',
  },
  admin: {
    label: '管理员',
    icon: <Shield className="w-4 h-4" />,
    color: 'text-blue-500',
  },
  member: {
    label: '成员',
    icon: <Users className="w-4 h-4" />,
    color: 'text-green-500',
  },
  viewer: {
    label: '查看者',
    icon: <Eye className="w-4 h-4" />,
    color: 'text-gray-500',
  },
};

// ==================== 子组件 ====================

/**
 * 成员列表项
 */
const MemberListItem: React.FC<{
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
  onRoleChange: (userId: string, role: TeamRole) => void;
  onRemove: (userId: string) => void;
  onStatusChange: (userId: string, status: 'active' | 'suspended') => void;
}> = ({ member, isCurrentUser, canManage, onRoleChange, onRemove, onStatusChange }) => {
  const [showMenu, setShowMenu] = useState(false);
  const roleConfig = ROLE_CONFIG[member.role];

  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        {/* 头像 */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium">
            {member.userName.charAt(0).toUpperCase()}
          </div>
          {member.status === 'active' && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          )}
          {member.status === 'suspended' && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
          )}
        </div>

        {/* 信息 */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{member.userName}</span>
            {isCurrentUser && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                你
              </span>
            )}
            <span className={cn('flex items-center gap-1 text-xs', roleConfig.color)}>
              {roleConfig.icon}
              {roleConfig.label}
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{member.userEmail || member.userId}</div>
        </div>
      </div>

      {/* 操作 */}
      {canManage && !isCurrentUser && member.role !== 'owner' && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="py-1">
                <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">更改角色</div>
                {(['admin', 'member', 'viewer'] as TeamRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onRoleChange(member.userId, role);
                      setShowMenu(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2',
                      member.role === role && 'bg-blue-50 dark:bg-blue-900/20',
                    )}
                  >
                    {ROLE_CONFIG[role].icon}
                    {ROLE_CONFIG[role].label}
                    {member.role === role && <Check className="w-4 h-4 ml-auto text-blue-500" />}
                  </button>
                ))}

                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                {member.status === 'active' ? (
                  <button
                    onClick={() => {
                      onStatusChange(member.userId, 'suspended');
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-orange-600"
                  >
                    <UserX className="w-4 h-4" />
                    暂停成员
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onStatusChange(member.userId, 'active');
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-green-600"
                  >
                    <UserCheck className="w-4 h-4" />
                    激活成员
                  </button>
                )}

                <button
                  onClick={() => {
                    onRemove(member.userId);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  移除成员
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 邀请列表项
 */
const InvitationListItem: React.FC<{
  invitation: TeamInvitation;
  onAccept?: () => void;
  onDecline?: () => void;
}> = ({ invitation, onAccept, onDecline }) => {
  const isExpired = new Date(invitation.expiresAt) < new Date();
  const roleConfig = ROLE_CONFIG[invitation.role];

  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <Mail className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{invitation.email}</div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className={cn('flex items-center gap-1', roleConfig.color)}>
              {roleConfig.icon}
              {roleConfig.label}
            </span>
            <span>·</span>
            <span>由 {invitation.invitedByName} 邀请</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {invitation.status === 'pending' && !isExpired && (
          <>
            {onAccept && (
              <button
                onClick={onAccept}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
              >
                接受
              </button>
            )}
            {onDecline && (
              <button
                onClick={onDecline}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                拒绝
              </button>
            )}
          </>
        )}

        {invitation.status === 'accepted' && (
          <span className="flex items-center gap-1 text-green-600 text-sm">
            <Check className="w-4 h-4" />
            已接受
          </span>
        )}

        {invitation.status === 'declined' && (
          <span className="flex items-center gap-1 text-red-600 text-sm">
            <X className="w-4 h-4" />
            已拒绝
          </span>
        )}

        {(invitation.status === 'expired' || isExpired) && (
          <span className="flex items-center gap-1 text-gray-500 text-sm">
            <Clock className="w-4 h-4" />
            已过期
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 项目共享列表项
 */
const ProjectShareListItem: React.FC<{
  share: TeamProjectShare;
  canManage: boolean;
  onPermissionChange: (projectId: string, permission: 'view' | 'edit' | 'admin') => void;
  onUnshare: (projectId: string) => void;
}> = ({ share, canManage, onPermissionChange, onUnshare }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
          <FolderOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{share.projectName}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            由 {share.sharedBy} 共享 · {share.metadata.accessCount} 次访问
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            'px-2 py-1 rounded text-xs font-medium',
            share.permissions === 'admin' && 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
            share.permissions === 'edit' && 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
            share.permissions === 'view' && 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
          )}
        >
          {share.permissions === 'admin' ? '管理' : share.permissions === 'edit' ? '编辑' : '查看'}
        </span>

        {canManage && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="py-1">
                  {(['view', 'edit', 'admin'] as const).map((perm) => (
                    <button
                      key={perm}
                      onClick={() => {
                        onPermissionChange(share.projectId, perm);
                        setShowMenu(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
                        share.permissions === perm && 'bg-blue-50 dark:bg-blue-900/20',
                      )}
                    >
                      {perm === 'admin' ? '管理' : perm === 'edit' ? '编辑' : '查看'}
                    </button>
                  ))}

                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

                  <button
                    onClick={() => {
                      onUnshare(share.projectId);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"
                  >
                    取消共享
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 审计日志列表项
 */
const AuditLogListItem: React.FC<{ log: TeamAuditLog }> = ({ log }) => {
  const actionLabels: Record<string, string> = {
    'team.created': '创建了团队',
    'team.updated': '更新了团队信息',
    'member.invited': '邀请了成员',
    'member.joined': '加入了团队',
    'member.left': '离开了团队',
    'member.removed': '移除了成员',
    'member.role_changed': '更改了成员角色',
    'member.status_changed': '更改了成员状态',
    'project.shared': '共享了项目',
    'project.unshared': '取消了项目共享',
    'project.permission_changed': '更改了项目权限',
    'settings.updated': '更新了团队设置',
    'invitation.sent': '发送了邀请',
    'invitation.accepted': '接受了邀请',
    'invitation.declined': '拒绝了邀请',
  };

  return (
    <div className="flex items-start gap-3 p-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mt-0.5">
        <Activity className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1">
        <div className="text-sm text-gray-900 dark:text-gray-100">
          <span className="font-medium">{log.userName}</span>
          <span className="text-gray-500 dark:text-gray-400"> {actionLabels[log.action] || log.action}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {new Date(log.timestamp).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
};

// ==================== 主组件 ====================

/**
 * 团队管理面板
 */
export const TeamManagementPanel: React.FC<TeamManagementPanelProps> = ({
  teamManager: externalManager,
  currentUserId,
  currentUserName,
  onTeamUpdate,
  onMemberUpdate,
}) => {
  const { t } = useTranslation();

  // 状态管理
  const [manager] = useState(() => externalManager || createTeamManager());
  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [inviteMessage, setInviteMessage] = useState('');

  // 获取状态
  const team = manager.getTeam();
  const members = manager.getMembers();
  const invitations = manager.getPendingInvitations();
  const sharedProjects = manager.getSharedProjects();
  const auditLog = manager.getAuditLog(50);

  // 当前用户信息
  const currentUser = manager.getMember(currentUserId);
  const canManage = currentUser?.permissions.canManageRoles || false;

  // 过滤成员
  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.userName.toLowerCase().includes(query) ||
        m.userEmail?.toLowerCase().includes(query) ||
        m.userId.toLowerCase().includes(query),
    );
  }, [members, searchQuery]);

  // 处理邀请
  const handleInvite = useCallback(() => {
    if (!inviteEmail) return;

    const result = manager.sendInvitation(inviteEmail, inviteRole, currentUserId, currentUserName, inviteMessage);

    if (result.success) {
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('member');
      setInviteMessage('');
    }
  }, [manager, inviteEmail, inviteRole, inviteMessage, currentUserId, currentUserName]);

  // 处理角色变更
  const handleRoleChange = useCallback(
    (userId: string, role: TeamRole) => {
      manager.updateMemberRole(userId, role, currentUserId, currentUserName);
      onMemberUpdate?.(manager.getMembers());
    },
    [manager, currentUserId, currentUserName, onMemberUpdate],
  );

  // 处理成员移除
  const handleRemoveMember = useCallback(
    (userId: string) => {
      if (window.confirm('确定要移除该成员吗？')) {
        manager.removeMember(userId, currentUserId, currentUserName);
        onMemberUpdate?.(manager.getMembers());
      }
    },
    [manager, currentUserId, currentUserName, onMemberUpdate],
  );

  // 处理状态变更
  const handleStatusChange = useCallback(
    (userId: string, status: 'active' | 'suspended') => {
      manager.updateMemberStatus(userId, status, currentUserId, currentUserName);
      onMemberUpdate?.(manager.getMembers());
    },
    [manager, currentUserId, currentUserName, onMemberUpdate],
  );

  // 标签页配置
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'members', label: '成员', icon: <Users className="w-4 h-4" />, count: members.length },
    { id: 'invitations', label: '邀请', icon: <Mail className="w-4 h-4" />, count: invitations.length },
    { id: 'projects', label: '共享项目', icon: <FolderOpen className="w-4 h-4" />, count: sharedProjects.length },
    { id: 'settings', label: '设置', icon: <Settings className="w-4 h-4" /> },
    { id: 'audit', label: '审计日志', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{team.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{team.description || '暂无描述'}</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInviteDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              邀请成员
            </button>
          )}
        </div>

        {/* 标签页 */}
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 成员标签页 */}
        {activeTab === 'members' && (
          <div>
            {/* 搜索栏 */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索成员..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 成员列表 */}
            <div className="space-y-1">
              {filteredMembers.map((member) => (
                <MemberListItem
                  key={member.userId}
                  member={member}
                  isCurrentUser={member.userId === currentUserId}
                  canManage={canManage}
                  onRoleChange={handleRoleChange}
                  onRemove={handleRemoveMember}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>

            {filteredMembers.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {searchQuery ? '未找到匹配的成员' : '暂无成员'}
              </div>
            )}
          </div>
        )}

        {/* 邀请标签页 */}
        {activeTab === 'invitations' && (
          <div className="space-y-1">
            {invitations.map((invitation) => (
              <InvitationListItem key={invitation.id} invitation={invitation} />
            ))}

            {invitations.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">暂无待处理的邀请</div>
            )}
          </div>
        )}

        {/* 共享项目标签页 */}
        {activeTab === 'projects' && (
          <div className="space-y-1">
            {sharedProjects.map((share) => (
              <ProjectShareListItem
                key={share.id}
                share={share}
                canManage={canManage}
                onPermissionChange={(projectId, permission) => {
                  manager.updateProjectPermission(projectId, permission, currentUserId, currentUserName);
                }}
                onUnshare={(projectId) => {
                  manager.unshareProject(projectId, currentUserId, currentUserName);
                }}
              />
            ))}

            {sharedProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">暂无共享项目</div>
            )}
          </div>
        )}

        {/* 设置标签页 */}
        {activeTab === 'settings' && canManage && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">团队信息</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">团队名称</label>
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => {
                      manager.updateTeam({ name: e.target.value }, currentUserId, currentUserName);
                      onTeamUpdate?.(manager.getTeam());
                    }}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">描述</label>
                  <textarea
                    value={team.description}
                    onChange={(e) => {
                      manager.updateTeam({ description: e.target.value }, currentUserId, currentUserName);
                      onTeamUpdate?.(manager.getTeam());
                    }}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">团队设置</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">允许成员邀请</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">成员可以邀请新成员加入团队</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={team.settings.allowMemberInvite}
                    onChange={(e) => {
                      manager.updateSettings({ allowMemberInvite: e.target.checked }, currentUserId, currentUserName);
                    }}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">允许创建项目</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">成员可以在团队中创建新项目</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={team.settings.allowProjectCreation}
                    onChange={(e) => {
                      manager.updateSettings(
                        { allowProjectCreation: e.target.checked },
                        currentUserId,
                        currentUserName,
                      );
                    }}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">启用审计日志</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">记录团队中的所有操作</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={team.settings.enableAuditLog}
                    onChange={(e) => {
                      manager.updateSettings({ enableAuditLog: e.target.checked }, currentUserId, currentUserName);
                    }}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 审计日志标签页 */}
        {activeTab === 'audit' && (
          <div className="space-y-1">
            {auditLog.map((log) => (
              <AuditLogListItem key={log.id} log={log} />
            ))}

            {auditLog.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">暂无审计日志</div>
            )}
          </div>
        )}
      </div>

      {/* 邀请对话框 */}
      {showInviteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">邀请新成员</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">邮箱地址</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="输入邮箱地址"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">角色</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="viewer">查看者</option>
                    <option value="member">成员</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">消息（可选）</label>
                  <textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="添加邀请消息..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowInviteDialog(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  发送邀请
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagementPanel;
