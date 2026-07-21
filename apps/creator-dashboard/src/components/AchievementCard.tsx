import { Rocket, Download, Star, Trophy, Crown, Heart, Globe, Diamond } from 'lucide-react';
import type { Achievement } from '@/lib/mock-data';

interface AchievementCardProps {
  achievement: Achievement;
}

const iconMap: Record<string, React.ReactNode> = {
  rocket: <Rocket size={20} />,
  download: <Download size={20} />,
  star: <Star size={20} />,
  trophy: <Trophy size={20} />,
  crown: <Crown size={20} />,
  heart: <Heart size={20} />,
  globe: <Globe size={20} />,
  diamond: <Diamond size={20} />,
};

export function AchievementCard({ achievement }: AchievementCardProps) {
  const icon = iconMap[achievement.icon] ?? <Star size={20} />;
  const progressPercent = achievement.progress !== undefined && achievement.maxProgress
    ? (achievement.progress / achievement.maxProgress) * 100
    : null;

  return (
    <div
      className={`bg-surface-raised border rounded-xl p-4 flex items-start gap-3 transition-colors ${
        achievement.unlocked ? 'border-accent/30' : 'border-border opacity-60'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          achievement.unlocked ? 'bg-accent/15 text-accent' : 'bg-surface-overlay text-foreground-muted'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{achievement.title}</div>
        <p className="text-xs text-foreground-muted mt-0.5">{achievement.description}</p>
        {progressPercent !== null && !achievement.unlocked && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-foreground-muted mb-1">
              <span>{achievement.progress}/{achievement.maxProgress}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-overlay rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
        {achievement.unlocked && (
          <span className="inline-block mt-1 text-[10px] text-success font-medium">Unlocked</span>
        )}
      </div>
    </div>
  );
}
