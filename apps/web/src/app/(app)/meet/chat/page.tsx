import { ChatThread } from '../../../../shell/maquettes/chat-thread';
import { Photo, TopBar } from '../../../../shell/maquettes/kit';

export default function MeetChatPage() {
  return (
    <div className="flex flex-1 flex-col gap-2 pb-4">
      <TopBar title="Mireille" back="/meet/match" eyebrow="Date dimanche 16:00" />
      <div className="flex items-center gap-2 pb-2">
        <Photo name="Mireille" variant={1} className="h-9 w-9 rounded-full" />
        <p className="text-xs text-muted">
          Conversation du date · aucun numéro ni lien ne circule ici
        </p>
      </div>
      <ChatThread peer="Mireille" />
    </div>
  );
}
