import { PrivacyControls } from '../../../../shell/maquettes/privacy-controls';
import { TopBar } from '../../../../shell/maquettes/kit';

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Confidentialité" back="/me" eyebrow="Notifications et données" />
      <PrivacyControls />
    </div>
  );
}
