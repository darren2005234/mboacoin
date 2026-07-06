import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Conditions Générales d'Utilisation — MboaCoin" };

export default function ConditionsPage() {
  return (
    <div className="flex flex-col pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Link href="/profile" aria-label="Retour" className="text-muted-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-sm font-bold">Conditions Générales d'Utilisation</h1>
      </header>

      <div className="legal space-y-4 px-5 py-5 text-sm leading-relaxed text-foreground/85">
        <p className="text-xs text-muted-foreground">Dernière mise à jour : 6 juillet 2026</p>

        <p>
          Bienvenue sur MboaCoin. Les présentes Conditions Générales d'Utilisation (les « CGU »)
          régissent l'accès et l'utilisation de la plateforme MboaCoin, accessible via application
          mobile et site web (le « Service »). En créant un compte ou en utilisant le Service, vous
          acceptez sans réserve les présentes CGU. Si vous ne les acceptez pas, vous ne devez pas
          utiliser le Service.
        </p>

        <Section title="1. Éditeur du Service">
          Le Service MboaCoin est édité par Darren Touopi (l'« Éditeur »), en attendant la
          constitution d'une société dédiée dont les informations seront mises à jour dès son
          immatriculation. Contact : contact@darrentouopi.com
        </Section>

        <Section title="2. Objet du Service">
          MboaCoin est une plateforme de mise en relation dans le domaine de la location immobilière
          au Cameroun. Le Service permet aux propriétaires et mandataires (les « Bailleurs ») de
          publier des annonces de biens à louer, aux personnes recherchant un logement (les
          « Locataires ») de consulter ces annonces, de contacter les Bailleurs et d'organiser des
          visites, la mise en relation via une messagerie interne, ainsi que le traitement de
          paiements sécurisés liés à la réservation, selon les modalités de l'article 8. MboaCoin
          agit en qualité d'intermédiaire technique de mise en relation. MboaCoin n'est ni
          propriétaire, ni bailleur, ni agent immobilier des biens publiés, et n'est pas partie aux
          contrats de location conclus entre les utilisateurs.
        </Section>

        <Section title="3. Création et gestion du compte">
          L'accès aux fonctionnalités nécessite la création d'un compte. L'inscription s'effectue au
          moyen d'un numéro de téléphone, vérifié par l'envoi d'un code à usage unique (OTP).
          L'utilisateur s'engage à fournir des informations exactes et à les maintenir à jour. Il est
          seul responsable de la confidentialité de l'accès à son compte. Toute action effectuée
          depuis un compte est réputée émaner de son titulaire. L'utilisation du Service est réservée
          aux personnes âgées d'au moins 18 ans ou disposant de la capacité juridique de contracter.
        </Section>

        <Section title="4. Obligations des utilisateurs">
          L'utilisateur s'engage à utiliser le Service de manière loyale. Il s'interdit notamment de
          publier des annonces fausses, trompeuses ou concernant des biens qu'il n'est pas autorisé à
          louer, d'usurper l'identité d'un tiers, de publier des contenus illicites ou portant
          atteinte aux droits d'autrui, de solliciter des paiements en dehors des mécanismes prévus
          par le Service, de collecter les données d'autres utilisateurs sans autorisation, ou de
          perturber le fonctionnement du Service.
        </Section>

        <Section title="5. Publication des annonces">
          Le Bailleur est seul responsable du contenu des annonces qu'il publie, de leur exactitude,
          de leur licéité et de sa capacité effective à louer le bien. Il garantit disposer de tous
          les droits nécessaires sur les photographies et informations publiées. MboaCoin se réserve
          le droit de refuser, suspendre ou retirer toute annonce ne respectant pas les présentes CGU
          ou la réglementation applicable.
        </Section>

        <Section title="6. Vérification des Bailleurs">
          MboaCoin peut proposer un statut de Bailleur « vérifié », attribué après un contrôle de ses
          équipes. Ce statut constitue un indice de confiance mais ne saurait constituer une garantie
          absolue de la fiabilité du Bailleur ou de la conformité du bien. L'utilisateur demeure tenu
          à sa propre vigilance.
        </Section>

        <Section title="7. Messagerie et échanges">
          Le Service met à disposition une messagerie interne. Les échanges sont conservés au sein de
          la plateforme afin d'assurer la traçabilité des relations et la sécurité des utilisateurs.
          Il est recommandé de conserver l'ensemble des échanges relatifs à une location au sein de
          la messagerie. Tout comportement abusif peut être signalé et entraîner des sanctions.
        </Section>

        <Section title="8. Paiements et sécurisation des transactions">
          Le Service peut proposer un mécanisme de paiement sécurisé permettant de verser un acompte
          ou de sécuriser une réservation via un système de séquestre. Les sommes versées peuvent
          être conservées par un prestataire de paiement partenaire jusqu'à la réalisation des
          conditions convenues. Les paiements sont opérés par des prestataires agréés ; MboaCoin n'a
          pas accès aux données bancaires complètes. Les modalités précises sont présentées au moment
          de chaque transaction. MboaCoin ne saurait être tenue responsable des différends relatifs à
          l'exécution du contrat de location lui-même.
        </Section>

        <Section title="9. Responsabilité">
          MboaCoin fournit une plateforme de mise en relation et met en œuvre des moyens raisonnables
          pour en assurer le bon fonctionnement. MboaCoin ne garantit pas l'exactitude ou la
          disponibilité effective des biens, la solvabilité ou le sérieux des utilisateurs, ni la
          bonne exécution des contrats. Les contrats de location sont conclus directement entre
          utilisateurs, sous leur seule responsabilité. Il appartient à chacun de vérifier l'identité
          de son interlocuteur, l'existence et l'état du bien, et de n'effectuer aucun versement en
          dehors des mécanismes sécurisés prévus.
        </Section>

        <Section title="10. Signalement et modération">
          Tout utilisateur peut signaler une annonce ou un autre utilisateur. MboaCoin examine les
          signalements et peut prendre toute mesure appropriée, incluant l'avertissement, la
          suspension ou la suppression d'un compte ou d'une annonce.
        </Section>

        <Section title="11. Suspension et résiliation">
          L'utilisateur peut à tout moment cesser d'utiliser le Service et demander la suppression de
          son compte. MboaCoin peut suspendre ou supprimer un compte en cas de manquement aux
          présentes CGU, de comportement frauduleux, ou pour tout motif légitime lié à la sécurité.
        </Section>

        <Section title="12. Propriété intellectuelle">
          La plateforme MboaCoin, sa charte graphique, ses marques, logos et éléments logiciels
          demeurent la propriété exclusive de l'Éditeur. Les utilisateurs conservent leurs droits sur
          les contenus qu'ils publient mais accordent à MboaCoin une licence non exclusive
          d'utilisation aux seules fins de fonctionnement et de promotion du Service.
        </Section>

        <Section title="13. Données personnelles">
          Le traitement des données personnelles est décrit dans la{" "}
          <Link href="/legal/confidentialite" className="font-semibold text-primary">
            Politique de Confidentialité
          </Link>
          , qui fait partie intégrante des présentes CGU.
        </Section>

        <Section title="14. Modification des CGU">
          MboaCoin peut modifier les présentes CGU pour les adapter à l'évolution du Service ou de la
          réglementation. Les utilisateurs seront informés de toute modification substantielle. La
          poursuite de l'utilisation après notification vaut acceptation des CGU modifiées.
        </Section>

        <Section title="15. Droit applicable et litiges">
          Les présentes CGU sont régies par le droit applicable au Cameroun. En cas de litige, les
          parties rechercheront une solution amiable avant toute action contentieuse. À défaut, le
          litige sera porté devant les juridictions compétentes. Contact : contact@darrentouopi.com
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
