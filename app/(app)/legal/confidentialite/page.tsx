import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Politique de Confidentialité — MboaCoin" };

export default function ConfidentialitePage() {
  return (
    <div className="flex flex-col pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Link href="/profile" aria-label="Retour" className="text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-sm font-bold">Politique de Confidentialité</h1>
      </header>

      <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-foreground/85">
        <p className="text-xs text-muted-foreground">Dernière mise à jour : 6 juillet 2026</p>

        <p>
          La présente Politique décrit la manière dont MboaCoin (« nous ») collecte, utilise,
          conserve et protège vos données personnelles dans le cadre de l'utilisation de la
          plateforme (le « Service »). En utilisant le Service, vous acceptez les pratiques décrites
          ci-dessous.
        </p>

        <Section title="1. Responsable du traitement">
          Le responsable du traitement est Darren Touopi, éditeur du Service, en attendant la
          constitution d'une société dédiée. Contact : contact@darrentouopi.com
        </Section>

        <Section title="2. Données que nous collectons">
          Nous collectons votre numéro de téléphone (identifiant principal), votre nom ou pseudonyme,
          votre ville, votre photo de profil si vous en ajoutez une, et le cas échéant une adresse
          e-mail secondaire. Concernant les annonces : les informations et photographies des biens
          publiés et leur localisation. Concernant les échanges : le contenu des messages, les
          informations de mise en relation, de réservation et de signalement. Concernant les
          paiements : les informations nécessaires au traitement des transactions, les données de
          paiement complètes étant traitées directement par nos prestataires et non conservées par
          nous. Nous collectons également des données techniques relatives à votre appareil et votre
          connexion, pour la sécurité et le bon fonctionnement du Service.
        </Section>

        <Section title="3. Finalités">
          Nous utilisons vos données pour créer et gérer votre compte et vous authentifier par code à
          usage unique, permettre la publication et la consultation des annonces, assurer la mise en
          relation, permettre les échanges via la messagerie et en assurer la traçabilité, traiter
          les paiements et sécuriser les transactions, assurer la sécurité et prévenir la fraude,
          améliorer le Service, et respecter nos obligations légales.
        </Section>

        <Section title="4. Base légale">
          Nous traitons vos données sur le fondement de l'exécution du contrat qui nous lie à vous, de
          votre consentement, de notre intérêt légitime (sécurité, prévention de la fraude,
          amélioration), et du respect de nos obligations légales.
        </Section>

        <Section title="5. Partage des données">
          Vos données ne sont jamais vendues. Elles peuvent être partagées avec les autres
          utilisateurs, dans la limite nécessaire à la mise en relation (votre nom, photo, ville,
          statut de vérification et annonces sont visibles ; votre numéro de téléphone n'est pas
          affiché publiquement), avec nos prestataires techniques (hébergement, envoi des SMS,
          paiement) tenus à la confidentialité, et avec les autorités compétentes lorsque la loi
          l'exige.
        </Section>

        <Section title="6. Prestataires et transferts">
          Certains prestataires (hébergement, SMS, paiement) peuvent traiter des données en dehors du
          Cameroun. Nous veillons à ce qu'ils présentent des garanties appropriées de protection.
        </Section>

        <Section title="7. Durée de conservation">
          Nous conservons vos données pendant la durée nécessaire aux finalités décrites, notamment
          tant que votre compte est actif. Certaines données peuvent être conservées au-delà pour
          répondre à nos obligations légales, résoudre des litiges ou faire respecter nos accords. Les
          échanges liés à une transaction peuvent être conservés à des fins de traçabilité.
        </Section>

        <Section title="8. Sécurité">
          Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour
          protéger vos données. L'accès aux données est restreint et encadré. Toutefois, aucun système
          n'étant totalement inviolable, nous ne pouvons garantir une sécurité absolue.
        </Section>

        <Section title="9. Vos droits">
          Vous disposez d'un droit d'accès, de rectification, de suppression, d'opposition et de
          limitation du traitement, dans les conditions prévues par la réglementation applicable. Vous
          pouvez exercer ces droits ou demander la suppression de votre compte en nous contactant à :
          contact@darrentouopi.com
        </Section>

        <Section title="10. Données des mineurs">
          Le Service n'est pas destiné aux personnes de moins de 18 ans. Nous ne collectons pas
          sciemment de données concernant des mineurs.
        </Section>

        <Section title="11. Modification de la Politique">
          Nous pouvons modifier la présente Politique pour l'adapter à l'évolution du Service ou de la
          réglementation. Vous serez informé de toute modification substantielle.
        </Section>

        <Section title="12. Contact">
          Pour toute question relative à vos données personnelles, contactez-nous à :
          contact@darrentouopi.com
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      <p>{children}</p>
    </div>
  );
}
