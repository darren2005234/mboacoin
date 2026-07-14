import { readFileSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface ReceiptData {
  receiptNumber: string;
  tenantName: string;
  landlordName: string;
  listingLabel: string;
  listingAddress: string | null;
  period: string; // date ISO du mois/de la période couverte
  amount: number;
  paidAt: string; // date ISO
  method: string;
  issuedAt: Date;
  verificationUrl: string;
  /** Nombre de mois du même versement groupé, si cette quittance en fait partie. */
  batchMonthCount: number | null;
}

// Réutilise le PNG déjà rasterisé depuis lib/logo-svg.mjs par
// scripts/generate-pwa-icons.mjs — pas de rasterisation à la demande ici
// (éviterait d'ajouter sharp aux dépendances de production pour ce seul besoin),
// et surtout pas de logo redessiné à la main.
const LOGO_PNG = readFileSync(path.join(process.cwd(), "public", "icons", "icon-512.png"));

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: "#1f2937" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  logo: { width: 40, height: 40 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 24 },
  section: { marginBottom: 16 },
  label: { fontSize: 9, color: "#6b7280", marginBottom: 2 },
  value: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  amountBox: {
    marginTop: 8,
    marginBottom: 24,
    padding: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  amount: { fontSize: 22, fontWeight: 700 },
  footer: { marginTop: 32, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 12 },
  mention: { fontSize: 9, color: "#6b7280", marginBottom: 4 },
  disclaimer: { fontSize: 9, color: "#92400e", marginTop: 8 },
  verification: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  qr: { width: 64, height: 64 },
  verificationCaption: { fontSize: 8, color: "#6b7280", flex: 1 },
});

function formatFCFA(amount: number): string {
  // Intl.NumberFormat("fr-FR") sépare les milliers avec une espace fine
  // insécable (U+202F), absente de l'encodage des polices standard utilisées
  // par @react-pdf/renderer — elle s'affichait comme "/". On regroupe donc les
  // chiffres à la main avec une espace ASCII normale.
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatPeriodLabel(iso: string): string {
  const label = new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return `Loyer du mois de ${label}`;
}

function methodLabel(method: string): string {
  return method === "mobile_money" ? "Payé via MboaCoin (mobile money)" : "Déclaré par le bailleur";
}

export function ReceiptDocument({ data, qrCode }: { data: ReceiptData; qrCode: Buffer }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={LOGO_PNG} style={styles.logo} />
          <View>
            <Text style={styles.title}>Quittance de loyer</Text>
            <Text style={{ ...styles.subtitle, marginBottom: 0 }}>N° {data.receiptNumber}</Text>
          </View>
        </View>
        <View style={{ height: 20 }} />

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Locataire</Text>
              <Text style={styles.value}>{data.tenantName}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Bailleur</Text>
              <Text style={styles.value}>{data.landlordName}</Text>
            </View>
          </View>
          <Text style={styles.label}>Logement</Text>
          <Text style={styles.value}>
            {data.listingLabel}
            {data.listingAddress ? ` — ${data.listingAddress}` : ""}
          </Text>
          <Text style={styles.label}>Période couverte</Text>
          <Text style={styles.value}>{formatPeriodLabel(data.period)}</Text>
          {data.batchMonthCount ? (
            <Text style={styles.mention}>Fait partie d&apos;un versement de {data.batchMonthCount} mois.</Text>
          ) : null}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.label}>Montant payé</Text>
          <Text style={styles.amount}>{formatFCFA(data.amount)} F CFA</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date de paiement</Text>
              <Text style={styles.value}>{formatDate(data.paidAt)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date d&apos;émission</Text>
              <Text style={styles.value}>{formatDate(data.issuedAt.toISOString())}</Text>
            </View>
          </View>
          <Text style={styles.label}>Mode de paiement</Text>
          <Text style={styles.value}>{methodLabel(data.method)}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.mention}>Quittance émise via MboaCoin</Text>
          {data.method === "mobile_money" ? (
            <Text style={styles.disclaimer}>
              Ce paiement a transité par MboaCoin (mobile money) : la plateforme en garantit l&apos;exécution.
            </Text>
          ) : (
            <Text style={styles.disclaimer}>
              Ce document atteste d&apos;un paiement déclaré par le bailleur. Tant que ce paiement ne
              transite pas par la plateforme MboaCoin, celle-ci ne peut pas en garantir la véracité.
            </Text>
          )}

          <View style={styles.verification}>
            <Image src={qrCode} style={styles.qr} />
            <Text style={styles.verificationCaption}>
              Scannez pour vérifier l&apos;authenticité de ce document.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const qrCode = await QRCode.toBuffer(data.verificationUrl, { type: "png", margin: 1, width: 256 });
  return renderToBuffer(<ReceiptDocument data={data} qrCode={qrCode} />);
}
