import { ChatThread } from '../../../../shell/maquettes/chat-thread';
import { TopBar } from '../../../../shell/maquettes/kit';

const seed = [
  {
    id: 'f1',
    from: 'peer' as const,
    text: 'Salut ! Terrain confirmé pour dimanche, on garde le créneau ?',
    at: '10:02',
  },
  {
    id: 'f2',
    from: 'me' as const,
    text: 'Oui, on arrive un peu avant pour l’échauffement.',
    at: '10:05',
  },
  {
    id: 'f3',
    from: 'system' as const,
    text: 'Les horaires et le terrain se fixent par le sélecteur du match, pas par message.',
    at: '10:05',
  },
];

export default function FootballChatPage() {
  return (
    <div className="flex flex-1 flex-col gap-2 pb-4">
      <TopBar title="Droit United" back="/football/match" eyebrow="Chat des capitaines" />
      <ChatThread
        peer="Droit United"
        seed={seed}
        quickCards={['Terrain confirmé', 'On décale ?', 'Bien reçu']}
        reply="Bien reçu, à dimanche."
        notice="Filtre de sécurité : chiffres, liens, pseudos et demandes de contact sont bloqués. Un seul capitaine saisit le score, l’autre confirme."
      />
    </div>
  );
}
