import { Card } from '@/ui/components/shared/Card';

/**
 * CelebrationBanner component props.
 */
export interface CelebrationBannerProps {
  goalName: string;
  completedAt?: string;
}

/**
 * Banner displayed when a goal has been completed.
 * Shows a celebration message with confetti-style emoji decoration.
 */
export function CelebrationBanner({ goalName, completedAt }: CelebrationBannerProps) {
  const formattedDate = completedAt
    ? new Date(completedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Card className="ignite-celebration-banner">
      <div className="ignite-celebration-banner-content">
        <span className="ignite-celebration-banner-emoji">🎉</span>
        <div className="ignite-celebration-banner-text">
          <h3 className="ignite-celebration-banner-title">Goal Completed!</h3>
          <p className="ignite-celebration-banner-message">
            Congratulations on completing <strong>"{goalName}"</strong>!
            {formattedDate && (
              <span className="ignite-celebration-banner-date"> Completed on {formattedDate}.</span>
            )}
          </p>
        </div>
        <span className="ignite-celebration-banner-emoji">🎊</span>
      </div>
    </Card>
  );
}
