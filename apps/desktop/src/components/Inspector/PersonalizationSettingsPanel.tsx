import { useState, useCallback } from 'react';
import { Settings, Save } from 'lucide-react';
import type { UserProfile, PersonalizationConfig, InterestCategory } from '@open-factory/editor-core';
import {
  createDefaultUserProfile,
  createDefaultPersonalizationConfig,
  validateUserProfile,
  validatePersonalizationConfig,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiCreativeAssistant;

const AGE_GROUPS = [
  { value: 'child', label: '儿童 (3-12)' },
  { value: 'teen', label: '青少年 (13-17)' },
  { value: 'young-adult', label: '青年 (18-30)' },
  { value: 'adult', label: '成年 (31-60)' },
  { value: 'senior', label: '老年 (60+)' },
] as const;

const STYLES = [
  { value: 'modern', label: '现代' },
  { value: 'classic', label: '经典' },
  { value: 'minimalist', label: '极简' },
  { value: 'playful', label: '活泼' },
  { value: 'professional', label: '专业' },
] as const;

const DEVICES = [
  { value: 'mobile', label: '手机' },
  { value: 'tablet', label: '平板' },
  { value: 'desktop', label: '桌面' },
  { value: 'tv', label: '电视' },
] as const;

const INTERESTS: InterestCategory[] = [
  'technology', 'gaming', 'music', 'sports', 'food',
  'travel', 'education', 'entertainment', 'fashion', 'science',
  'art', 'fitness',
] as const;

const INTEREST_LABELS: Record<string, string> = {
  technology: '科技',
  gaming: '游戏',
  music: '音乐',
  sports: '体育',
  food: '美食',
  travel: '旅行',
  education: '教育',
  entertainment: '娱乐',
  fashion: '时尚',
  science: '科学',
  art: '艺术',
  fitness: '健身',
};

interface PersonalizationSettingsPanelProps {
  userId: string;
  onSave: (profile: UserProfile, config: PersonalizationConfig) => void;
}

export function PersonalizationSettingsPanel({
  userId,
  onSave,
}: PersonalizationSettingsPanelProps) {
  const [profile, setProfile] = useState<UserProfile>(() => createDefaultUserProfile(userId));
  const [config, setConfig] = useState<PersonalizationConfig>(() => createDefaultPersonalizationConfig());
  const [isDirty, setIsDirty] = useState(false);

  const updateProfile = (patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const updateConfig = (patch: Partial<PersonalizationConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const toggleInterest = (interest: InterestCategory) => {
    setProfile((prev) => {
      const interests = prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests };
    });
    setIsDirty(true);
  };

  const handleSave = useCallback(() => {
    if (!validateUserProfile(profile)) {
      showToast({ kind: 'error', title: '保存失败', message: '用户配置无效' });
      return;
    }
    if (!validatePersonalizationConfig(config)) {
      showToast({ kind: 'error', title: '保存失败', message: '个性化配置无效' });
      return;
    }
    onSave(profile, config);
    setIsDirty(false);
    showToast({ kind: 'success', title: '保存成功', message: '个性化设置已更新' });
  }, [profile, config, onSave]);

  return (
    <details className="mb-4" data-testid="personalization-settings-section">
      <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
        <Settings size={12} className="mr-1 inline" />
        个性化设置
      </summary>
      <div className="space-y-3 p-1">
        {/* Age Group */}
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">年龄段</label>
          <select
            className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            value={profile.ageGroup}
            onChange={(e) => updateProfile({ ageGroup: e.target.value as UserProfile['ageGroup'] })}
            data-testid="personalization-age-group"
          >
            {AGE_GROUPS.map((ag) => (
              <option key={ag.value} value={ag.value}>{ag.label}</option>
            ))}
          </select>
        </div>

        {/* Preferred Style */}
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">偏好风格</label>
          <select
            className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            value={profile.preferredStyle}
            onChange={(e) => updateProfile({ preferredStyle: e.target.value as UserProfile['preferredStyle'] })}
            data-testid="personalization-style"
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Device Preference */}
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">设备偏好</label>
          <select
            className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            value={profile.devicePreference}
            onChange={(e) => updateProfile({ devicePreference: e.target.value as UserProfile['devicePreference'] })}
            data-testid="personalization-device"
          >
            {DEVICES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Interests */}
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">兴趣标签</label>
          <div className="flex flex-wrap gap-1" data-testid="personalization-interests">
            {INTERESTS.map((interest) => (
              <button
                key={interest}
                type="button"
                className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                  profile.interests.includes(interest)
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                onClick={() => toggleInterest(interest)}
                data-testid={`personalization-interest-${interest}`}
              >
                {INTEREST_LABELS[interest] ?? interest}
              </button>
            ))}
          </div>
        </div>

        {/* Engagement Rate */}
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            互动率: {(profile.engagementRate * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={profile.engagementRate}
            onChange={(e) => updateProfile({ engagementRate: parseFloat(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
            data-testid="personalization-engagement"
          />
        </div>

        {/* Personalization Strength */}
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            个性化强度: {(config.personalizationStrength * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.personalizationStrength}
            onChange={(e) => updateConfig({ personalizationStrength: parseFloat(e.target.value) })}
            className="w-full accent-[var(--color-accent)]"
            data-testid="personalization-strength"
          />
        </div>

        {/* Feature Toggles */}
        <div className="space-y-1">
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">功能开关</label>
          {[
            { key: 'enableIntroPersonalization', label: '片头个性化' },
            { key: 'enableOutroPersonalization', label: '片尾个性化' },
            { key: 'enableSubtitlePersonalization', label: '字幕样式个性化' },
            { key: 'enableRecommendations', label: '内容推荐' },
            { key: 'enableInteractiveElements', label: '互动元素' },
          ].map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 text-xs cursor-pointer"
              data-testid={`personalization-toggle-${key}`}
            >
              <input
                type="checkbox"
                checked={config[key as keyof PersonalizationConfig] as boolean}
                onChange={(e) => updateConfig({ [key]: e.target.checked })}
                className="rounded border-line"
              />
              <span className="text-[var(--color-text-secondary)]">{label}</span>
            </label>
          ))}
        </div>

        {/* Save Button */}
        <button
          className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!isDirty}
          onClick={handleSave}
          data-testid="personalization-save"
        >
          <Save size={14} className="mr-1 inline" />
          保存设置
        </button>
      </div>
    </details>
  );
}
