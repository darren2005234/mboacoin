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
        <p className="text-xs text-muted-foreground">Dernière mise à jour : 17 juillet 2026</p>

        <p>
          Bienvenue sur MboaCoin. Les présentes Conditions Générales d'Utilisation (les « CGU »)
          régissent l'accès et l'utilisation de la plateforme MboaCoin, accessible via application
          et site web (le « Service »). En créant un compte ou en utilisant le Service, vous
          acceptez sans réserve les présentes CGU. Si vous ne les acceptez pas, vous ne devez pas
          utiliser le Service.
        </p>

        <Section title="1. Éditeur du Service">
          <p>
            Le Service MboaCoin est édité par Darren Touopi (l'« Éditeur »), personne physique, en
            attendant la constitution d'une société dédiée dont les informations seront mises à
            jour dès son immatriculation. Contact : contact@darrentouopi.com
          </p>
        </Section>

        <Section title="2. Objet du Service">
          <p>
            MboaCoin est une plateforme dédiée à la location immobilière au Cameroun. Le Service
            permet aux propriétaires, gestionnaires de résidences et mandataires (les
            « Bailleurs ») de publier des annonces de biens à louer, aux personnes recherchant un
            logement (les « Locataires ») de consulter ces annonces, de contacter les Bailleurs et
            d'organiser des visites, ainsi que de gérer la relation locative après la signature
            d'un bail (suivi des loyers, quittances, demandes, documents, état des lieux).
          </p>
          <p>
            MboaCoin agit en qualité d'intermédiaire technique et d'outil de gestion.{" "}
            <strong className="font-semibold">
              MboaCoin n'est ni propriétaire, ni bailleur, ni agent immobilier des biens publiés,
              et n'est pas partie aux contrats de location conclus entre les utilisateurs.
            </strong>{" "}
            MboaCoin ne perçoit, à ce jour, aucune commission sur les locations et ne traite aucun
            paiement de loyer ou de caution entre les utilisateurs.
          </p>
        </Section>

        <Section title="3. Création et gestion du compte">
          <p>
            L'accès aux fonctionnalités nécessite la création d'un compte. L'inscription
            s'effectue au moyen d'un numéro de téléphone, vérifié par l'envoi d'un code à usage
            unique (OTP).
          </p>
          <p>
            L'utilisateur s'engage à fournir des informations exactes et à les maintenir à jour.
            Il est seul responsable de la confidentialité de l'accès à son compte et du téléphone
            associé. Toute action effectuée depuis un compte est réputée émaner de son titulaire.
          </p>
          <p>
            L'utilisation du Service est réservée aux personnes âgées d'au moins 18 ans ou
            disposant de la capacité juridique de contracter.
          </p>
        </Section>

        <Section title="4. Types de comptes">
          <p>
            Un utilisateur peut disposer d'un compte de type particulier, agence immobilière, ou
            gestionnaire de résidence. Le type de compte détermine certaines fonctionnalités
            accessibles. Le passage à un type professionnel (agence, résidence) et la publication
            d'annonces à ce titre peuvent être soumis à une vérification préalable.
          </p>
        </Section>

        <Section title="5. Obligations des utilisateurs">
          <p>
            L'utilisateur s'engage à utiliser le Service de manière loyale. Il s'interdit
            notamment de publier des annonces fausses, trompeuses ou concernant des biens qu'il
            n'est pas autorisé à louer, d'usurper l'identité d'un tiers, de publier des contenus
            illicites ou portant atteinte aux droits d'autrui, de collecter les données d'autres
            utilisateurs sans autorisation, ou de perturber le fonctionnement du Service.
          </p>
        </Section>

        <Section title="6. Publication des annonces">
          <p>
            Le Bailleur est seul responsable du contenu des annonces qu'il publie, de leur
            exactitude, de leur licéité et de sa capacité effective à louer le bien. Il garantit
            disposer de tous les droits nécessaires sur les photographies et informations
            publiées.
          </p>
          <p>
            MboaCoin se réserve le droit de refuser, suspendre ou retirer toute annonce ne
            respectant pas les présentes CGU ou la réglementation applicable.
          </p>
        </Section>

        <Section title="7. Vérification d'identité et de confiance">
          <p>
            MboaCoin propose des mécanismes de vérification (d'identité, de compte professionnel,
            et de logement) destinés à renforcer la confiance entre utilisateurs. Un statut
            « vérifié » peut être attribué après un contrôle par les équipes de MboaCoin.
          </p>
          <p>
            Ce statut constitue un <strong className="font-semibold">indice de confiance</strong>{" "}
            mais ne saurait constituer une{" "}
            <strong className="font-semibold">garantie absolue</strong> de la fiabilité d'un
            utilisateur ou de la conformité d'un bien. L'utilisateur demeure tenu à sa propre
            vigilance : il lui appartient de vérifier l'identité de son interlocuteur et l'état
            réel du bien.
          </p>
          <p>
            Les documents transmis lors d'une vérification (pièce d'identité, photographie,
            document d'entité) sont traités conformément à la Politique de Confidentialité et ne
            sont pas conservés au-delà de ce qui est nécessaire.
          </p>
        </Section>

        <Section title="8. Visites">
          <p>
            Le Service permet à un Locataire de demander une visite et de proposer des créneaux,
            et à un Bailleur de les accepter, d'en proposer d'autres, ou de refuser. Une visite
            confirmée donne lieu à un code de confirmation que le Locataire communique au Bailleur
            sur place, afin d'attester que la visite a eu lieu.
          </p>
          <p>
            Un Bailleur peut indiquer des frais de visite.{" "}
            <strong className="font-semibold">
              Seul un compte vérifié peut facturer des frais de visite.
            </strong>{" "}
            À ce jour, MboaCoin ne traite pas le paiement de ces frais : leur règlement éventuel
            intervient directement entre les parties, hors de la plateforme.
          </p>
        </Section>

        <Section title="9. Gestion locative, baux et quittances">
          <p>
            Après accord entre les parties, un Bailleur peut créer un bail sur la plateforme et y
            rattacher un Locataire par son numéro de téléphone. Le Locataire confirme les
            conditions du bail avant qu'il ne devienne actif.
          </p>
          <p>
            Le Service permet ensuite le suivi de la relation locative : déclaration des paiements
            de loyer par le Bailleur, génération de quittances, demandes structurées entre les
            parties, dépôt du contrat, et état des lieux.
          </p>
          <p>
            <strong className="font-semibold">
              Point essentiel concernant les quittances :
            </strong>{" "}
            à ce jour, les paiements de loyer ne transitent pas par MboaCoin. Une quittance générée
            par le Service{" "}
            <strong className="font-semibold">
              atteste d'un paiement déclaré par le Bailleur
            </strong>
            . Elle ne constitue pas une preuve, par MboaCoin, que le paiement a effectivement eu
            lieu, MboaCoin n'étant pas partie à la transaction. Cette mention figure sur les
            quittances émises.
          </p>
        </Section>

        <Section title="10. Absence d'arbitrage des litiges">
          <p>
            MboaCoin fournit des outils de documentation et de traçabilité (messagerie, demandes,
            état des lieux, historique).{" "}
            <strong className="font-semibold">
              MboaCoin ne tranche pas les litiges entre utilisateurs et ne se prononce pas sur le
              droit.
            </strong>{" "}
            En cas de désaccord (par exemple sur la restitution d'une caution, l'état d'un
            logement ou la fin d'un bail), les parties demeurent seules responsables de leur
            résolution, le cas échéant devant les autorités compétentes. MboaCoin peut, sur
            demande, mettre à disposition les éléments dont elle dispose.
          </p>
        </Section>

        <Section title="11. Messagerie et échanges">
          <p>
            Le Service met à disposition une messagerie interne. Les échanges sont conservés au
            sein de la plateforme afin d'assurer la traçabilité des relations et la sécurité des
            utilisateurs. Il est recommandé de conserver l'ensemble des échanges relatifs à une
            location au sein de la messagerie. Tout comportement abusif peut être signalé et
            entraîner des sanctions.
          </p>
        </Section>

        <Section title="12. Signalement et modération">
          <p>
            Tout utilisateur peut signaler une annonce ou un autre utilisateur. MboaCoin examine
            les signalements et peut prendre toute mesure appropriée, incluant l'avertissement, la
            suspension ou le retrait d'un compte ou d'une annonce. Un service de support est
            accessible aux utilisateurs, y compris non connectés, pour toute demande ou difficulté.
          </p>
        </Section>

        <Section title="13. Responsabilité">
          <p>
            MboaCoin fournit une plateforme de mise en relation et de gestion, et met en œuvre des
            moyens raisonnables pour en assurer le bon fonctionnement. MboaCoin ne garantit pas
            l'exactitude ou la disponibilité effective des biens, la solvabilité ou le sérieux des
            utilisateurs, ni la bonne exécution des contrats de location.
          </p>
          <p>
            Les contrats de location sont conclus directement entre utilisateurs, sous leur seule
            responsabilité. Il appartient à chacun de vérifier l'identité de son interlocuteur,
            l'existence et l'état du bien, et de faire preuve de prudence, en particulier avant
            tout versement d'argent, lesquels interviennent hors de la plateforme et sous la seule
            responsabilité des parties.
          </p>
        </Section>

        <Section title="14. Suspension et résiliation">
          <p>
            L'utilisateur peut à tout moment cesser d'utiliser le Service et demander la
            suppression de son compte, dans les conditions décrites dans la Politique de
            Confidentialité. La suppression peut être différée ou restreinte tant qu'un bail actif
            ou un engagement en cours lie l'utilisateur à un tiers, afin de préserver les droits de
            ce dernier.
          </p>
          <p>
            MboaCoin peut suspendre ou supprimer un compte en cas de manquement aux présentes CGU,
            de comportement frauduleux, ou pour tout motif légitime lié à la sécurité.
          </p>
        </Section>

        <Section title="15. Propriété intellectuelle">
          <p>
            La plateforme MboaCoin, sa charte graphique, ses marques, logos et éléments logiciels
            demeurent la propriété exclusive de l'Éditeur. Les utilisateurs conservent leurs
            droits sur les contenus qu'ils publient mais accordent à MboaCoin une licence non
            exclusive d'utilisation, aux seules fins de fonctionnement et de promotion du Service.
          </p>
        </Section>

        <Section title="16. Données personnelles">
          <p>
            Le traitement des données personnelles est décrit dans la{" "}
            <Link href="/legal/confidentialite" className="font-semibold text-primary">
              Politique de Confidentialité
            </Link>
            , qui fait partie intégrante des présentes CGU.
          </p>
        </Section>

        <Section title="17. Modification des CGU">
          <p>
            MboaCoin peut modifier les présentes CGU pour les adapter à l'évolution du Service ou
            de la réglementation. Les utilisateurs seront informés de toute modification
            substantielle. La poursuite de l'utilisation après notification vaut acceptation des
            CGU modifiées.
          </p>
        </Section>

        <Section title="18. Droit applicable et litiges">
          <p>
            Les présentes CGU sont régies par le droit camerounais. En cas de litige, les parties
            rechercheront une solution amiable avant toute action contentieuse. À défaut, le
            litige sera porté devant les juridictions camerounaises compétentes. Contact :
            contact@darrentouopi.com
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
