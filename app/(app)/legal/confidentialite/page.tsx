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
        <p className="text-xs text-muted-foreground">Dernière mise à jour : 17 juillet 2026</p>

        <p>
          La présente Politique décrit la manière dont MboaCoin (« nous ») collecte, utilise,
          conserve et protège vos données personnelles dans le cadre de l'utilisation de la
          plateforme (le « Service »). Elle s'inscrit dans le respect de la loi camerounaise
          n°2024/017 du 23 décembre 2024 relative à la protection des données à caractère
          personnel.
        </p>

        <p>
          En utilisant le Service, vous reconnaissez avoir pris connaissance de la présente
          Politique.
        </p>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement est Darren Touopi, éditeur du Service, personne physique,
            en attendant la constitution d'une société dédiée. Contact : contact@darrentouopi.com
          </p>
        </Section>

        <Section title="2. Données que nous collectons">
          <p>Nous collectons :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-semibold">Données de compte</strong> : votre numéro de
              téléphone (identifiant principal), votre nom ou pseudonyme, votre ville, votre photo
              de profil si vous en ajoutez une, le type de compte, et le cas échéant une adresse
              e-mail secondaire.
            </li>
            <li>
              <strong className="font-semibold">Données de vérification</strong> (si vous
              choisissez de vous faire vérifier) : une pièce d'identité, une photographie (selfie)
              de vérification, et pour les comptes professionnels un document d'entité. Ces
              documents font l'objet de règles de conservation strictes décrites à l'article 7.
            </li>
            <li>
              <strong className="font-semibold">Données d'annonces</strong> : informations,
              photographies et localisation des biens publiés ; pour les vérifications de
              logement, une vidéo.
            </li>
            <li>
              <strong className="font-semibold">Données de la relation locative</strong> : baux,
              montants, dates, quittances, demandes, contrats déposés, états des lieux, y compris
              les photographies qui les composent.
            </li>
            <li>
              <strong className="font-semibold">Données d'échanges</strong> : contenu des
              messages, demandes de visite, signalements, tickets de support.
            </li>
            <li>
              <strong className="font-semibold">Données techniques</strong> : informations
              relatives à votre appareil et à votre connexion, à des fins de sécurité et de bon
              fonctionnement.
            </li>
          </ul>
          <p>
            Nous ne traitons aucune donnée bancaire : à ce jour, aucun paiement de loyer ou de
            caution ne transite par le Service.
          </p>
        </Section>

        <Section title="3. Finalités">
          <p>
            Nous utilisons vos données pour créer et gérer votre compte et vous authentifier,
            permettre la publication et la consultation des annonces, assurer la mise en relation
            et l'organisation des visites, permettre la gestion de la relation locative (baux,
            quittances, demandes, états des lieux), assurer la sécurité et prévenir la fraude,
            améliorer le Service, et respecter nos obligations légales.
          </p>
        </Section>

        <Section title="4. Base légale">
          <p>
            Nous traitons vos données sur le fondement de l'exécution du contrat qui nous lie à
            vous, de votre consentement (notamment pour la vérification d'identité, que vous êtes
            libre de ne pas demander), de notre intérêt légitime (sécurité, prévention de la
            fraude), et du respect de nos obligations légales.
          </p>
        </Section>

        <Section title="5. Partage des données">
          <p>
            <strong className="font-semibold">Vos données ne sont jamais vendues.</strong> Elles
            peuvent être partagées :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Avec les autres utilisateurs, dans la limite nécessaire à la mise en relation et à
              la relation locative : votre nom, votre photo, votre ville, votre statut de
              vérification et vos annonces sont visibles. Votre numéro de téléphone n'est pas
              affiché publiquement. Dans le cadre d'un bail, les informations nécessaires sont
              partagées entre le Bailleur et le Locataire concernés.
            </li>
            <li>
              Avec nos prestataires techniques (hébergement, envoi des SMS), tenus à la
              confidentialité et agissant sur nos instructions.
            </li>
            <li>Avec les autorités compétentes lorsque la loi l'exige.</li>
          </ul>
        </Section>

        <Section title="6. Hébergement et transfert de données">
          <p>
            Les données du Service sont hébergées au sein de l'
            <strong className="font-semibold">Union européenne (Francfort, Allemagne)</strong>,
            via notre prestataire d'infrastructure. Ce transfert hors du Cameroun s'accompagne
            d'un niveau de protection des données reconnu comme élevé.
          </p>
          <p>
            Certains prestataires (par exemple l'envoi des SMS de vérification) peuvent traiter
            des données dans d'autres pays ; nous veillons à ce qu'ils présentent des garanties
            appropriées.
          </p>
          <p>
            Nous vous informons que l'hébergement des données pourra évoluer, notamment vers un
            hébergement local, en fonction de l'évolution de la réglementation camerounaise et de
            ses textes d'application.
          </p>
        </Section>

        <Section title="7. Durée de conservation">
          <p>
            Nous appliquons un principe de{" "}
            <strong className="font-semibold">minimisation</strong> : nous ne conservons vos
            données que le temps nécessaire aux finalités poursuivies.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-semibold">
                Documents de vérification d'identité (pièce d'identité, selfie)
              </strong>{" "}
              : en cas de vérification <strong className="font-semibold">acceptée</strong>, ces
              documents sont supprimés <strong className="font-semibold">30 jours</strong> après
              la validation. Nous ne conservons alors que le fait que le compte est vérifié, la
              date, et une empreinte technique du document permettant d'en attester l'intégrité,
              sans conserver le document lui-même. En cas de vérification{" "}
              <strong className="font-semibold">refusée</strong>, ces documents sont supprimés
              sans délai.
            </li>
            <li>
              <strong className="font-semibold">Documents d'entité</strong> (comptes
              professionnels) : même principe, supprimés 30 jours après traitement.
            </li>
            <li>
              <strong className="font-semibold">Vidéos de vérification de logement</strong> :
              conservées le temps de vie de l'annonce concernée, et au maximum 12 mois.
            </li>
            <li>
              <strong className="font-semibold">
                Données de compte et données de la relation locative
              </strong>{" "}
              : conservées tant que votre compte est actif, puis selon les modalités de l'article
              8.
            </li>
            <li>
              <strong className="font-semibold">Données techniques et de sécurité</strong> :
              conservées pour une durée limitée à des fins de sécurité et de prévention de la
              fraude.
            </li>
          </ul>
          <p>
            La durée exacte de conservation de certaines catégories de données pourra être
            précisée en fonction du référentiel prévu par la réglementation camerounaise, lorsqu'il
            sera publié.
          </p>
        </Section>

        <Section title="8. Vos droits">
          <p>
            Conformément à la loi n°2024/017, vous disposez d'un droit d'accès, de rectification,
            de suppression, d'opposition et de limitation du traitement de vos données.
          </p>
          <p>
            Vous pouvez exercer ces droits, ou demander la suppression de votre compte,
            directement depuis le Service ou en nous contactant à contact@darrentouopi.com.
          </p>
          <p>
            <strong className="font-semibold">Concernant la suppression de compte :</strong>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Elle ne peut être exécutée tant qu'un{" "}
              <strong className="font-semibold">bail actif</strong> ou un engagement en cours vous
              lie à un tiers, afin de préserver les droits de ce dernier. Vous êtes informé de
              cette condition au moment de votre demande.
            </li>
            <li>
              Une fois la suppression possible, vos données d'identification (nom, photo,
              téléphone), vos annonces, vos favoris, votre historique, vos conversations et vos
              tickets sont supprimés.
            </li>
            <li>
              Certains documents à valeur probante liés à vos baux (quittances, états des lieux,
              baux terminés) sont{" "}
              <strong className="font-semibold">
                conservés sous une forme rendant votre identité non identifiable
              </strong>
              , car ils engagent également les droits de l'autre partie au bail. Les documents que
              vous avez signés ou fournis (contrat, photographies) peuvent, dans leur contenu
              même, continuer à mentionner votre nom, MboaCoin n'étant pas en mesure de modifier
              le contenu d'un document déjà établi entre les parties. Vous êtes informé de ces
              limites au moment de votre demande.
            </li>
          </ul>
        </Section>

        <Section title="9. Sécurité">
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos
            données : accès restreint et encadré aux données, contrôle des autorisations, stockage
            privé des documents sensibles. Toutefois, aucun système n'étant totalement inviolable,
            nous ne pouvons garantir une sécurité absolue.
          </p>
        </Section>

        <Section title="10. Données des mineurs">
          <p>
            Le Service n'est pas destiné aux personnes de moins de 18 ans. Nous ne collectons pas
            sciemment de données concernant des mineurs.
          </p>
        </Section>

        <Section title="11. Modification de la Politique">
          <p>
            Nous pouvons modifier la présente Politique pour l'adapter à l'évolution du Service ou
            de la réglementation. Vous serez informé de toute modification substantielle.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Pour toute question relative à vos données personnelles, ou pour exercer vos droits,
            contactez-nous à : contact@darrentouopi.com
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
