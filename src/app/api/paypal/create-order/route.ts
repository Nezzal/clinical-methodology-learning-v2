import { NextResponse } from 'next/server';
import { getPayPalAccessToken, getPayPalBaseUrl, calculatePlanPrice, isPayPalConfigured } from '@/utils/paypal';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tier, duration, residence, userEmail } = body;

    if (!tier || !duration || !residence) {
      return NextResponse.json({ error: "Champs requis manquants (tier, duration, residence)." }, { status: 400 });
    }

    if (!['pro', 'expert', 'ultra'].includes(tier)) {
      return NextResponse.json({ error: "Formule invalide pour le paiement PayPal." }, { status: 400 });
    }

    if (!['1m', '3m', '6m', '12m'].includes(duration)) {
      return NextResponse.json({ error: "Durée d'abonnement invalide." }, { status: 400 });
    }

    if (!['africa', 'western'].includes(residence)) {
      return NextResponse.json({ error: "Le paiement automatique PayPal est disponible pour la Zone Afrique et la Zone Occident." }, { status: 400 });
    }

    // Calcul strict du prix serveur
    const priceInfo = calculatePlanPrice(tier, duration, residence);

    // Si les clés secrètes d'API PayPal ne sont pas encore configurées en local, utiliser la simulation Sandbox de démonstration
    if (!isPayPalConfigured()) {
      console.log("ℹ️ [PayPal Sandbox Demo] Utilisation de la commande de démonstration locale.");
      return NextResponse.json({ orderID: `DEMO_PAYPAL_ORDER_${Date.now()}` });
    }

    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: priceInfo.currency,
            value: priceInfo.amount,
          },
          description: priceInfo.description,
          custom_id: JSON.stringify({
            tier,
            duration,
            residence,
            email: userEmail || ''
          })
        },
      ],
      application_context: {
        brand_name: 'Methodo&Clinique Platform',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING'
      }
    };

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erreur lors de la création de commande PayPal:", data);
      return NextResponse.json({ error: data.message || "Erreur de création de la commande PayPal." }, { status: response.status });
    }

    return NextResponse.json({ orderID: data.id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erreur interne lors de l'initialisation du paiement PayPal.";
    console.error("❌ Erreur API /api/paypal/create-order:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
