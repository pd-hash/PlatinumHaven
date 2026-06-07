const router = require('express').Router();
const fetch = require('node-fetch');
const { authenticate } = require('../middleware/auth');

const paypalMode = (process.env.PAYPAL_MODE || process.env.PAYPAL_ENV || 'sandbox').toLowerCase();

const getPayPalBaseUrl = () => {
  return paypalMode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
};

const getPayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const error = new Error('PayPal credentials are not configured');
    error.statusCode = 503;
    throw error;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to get PayPal access token');
  }

  return data.access_token;
};

const findLink = (links, rel) =>
  Array.isArray(links) ? links.find((link) => link.rel === rel)?.href || null : null;

router.post('/create-order', authenticate, async (req, res, next) => {
  try {
    const amountValue = Number(req.body?.amount);
    const currency = String(req.body?.currency || 'PHP').toUpperCase();
    const description = String(req.body?.description || 'Platinum Haven booking');
    const brandName = String(process.env.PAYPAL_BRAND_NAME || 'Platinum Haven');

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ error: 'A valid amount is required' });
    }

    const accessToken = await getPayPalAccessToken();
    const returnUrl = process.env.PAYPAL_RETURN_URL || 'platinumhavenpay://checkout/return';
    const cancelUrl = process.env.PAYPAL_CANCEL_URL || 'platinumhavenpay://checkout/cancel';
    const amount = amountValue.toFixed(2);

    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
            description,
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: brandName,
              return_url: returnUrl,
              cancel_url: cancelUrl,
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.message || data?.details?.[0]?.description || 'Failed to create PayPal order';
      return res.status(response.status).json({ error: message });
    }

    res.json({
      orderId: data.id,
      status: data.status,
      approveUrl: findLink(data.links, 'approve') || findLink(data.links, 'payer-action'),
    });
  } catch (error) {
    if (error?.statusCode === 503) {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/capture-order', authenticate, async (req, res, next) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.message || data?.details?.[0]?.description || 'Failed to capture PayPal order';
      return res.status(response.status).json({ error: message });
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0] || null;
    res.json({
      orderId: data.id,
      status: data.status,
      captureId: capture?.id || null,
      captureStatus: capture?.status || null,
    });
  } catch (error) {
    if (error?.statusCode === 503) {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;
