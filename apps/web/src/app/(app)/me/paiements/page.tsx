import { PaymentsList } from '../../../../shell/maquettes/payments-list';
import { TopBar } from '../../../../shell/maquettes/kit';

export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Mes paiements" back="/me" eyebrow="Séquestre et remboursements" />
      <PaymentsList />
    </div>
  );
}
