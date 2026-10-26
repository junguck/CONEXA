import { Badge } from '@conexa/ui';

import { notifications } from '../../../../shell/maquettes/data';
import { Hint, TopBar } from '../../../../shell/maquettes/kit';

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Notifications"
        back="/me"
        eyebrow="3 par jour maximum"
        right={<Badge tone="bad">2 non lues</Badge>}
      />

      <div className="flex flex-col">
        {notifications.map((notification) => (
          <article
            key={notification.title}
            className="flex gap-3 border-b border-line py-3.5 last:border-0"
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 flex-none rounded-full ${notification.unread ? 'bg-accent' : 'bg-line'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{notification.title}</p>
              <p className="text-sm text-muted">{notification.body}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">{notification.time}</p>
            </div>
          </article>
        ))}
      </div>

      <Hint>
        Les notifications promotionnelles sont désactivées par défaut. Chaque notification peut être
        réglée depuis Moi.
      </Hint>
    </div>
  );
}
