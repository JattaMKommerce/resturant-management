/**
 * Opens the Razorpay payment window for a payment created by POST /payments/initiate and
 * reports the outcome to the server. Resolves with:
 *   { status: 'paid' }                       payment verified by the server
 *   { status: 'failed', message }            gateway or verification failure (recorded as FAILED)
 *   { status: 'dismissed' }                  customer closed the window without paying
 *
 * `post(url, body)` must resolve to the JSON body of the response (so it works with both API
 * clients in this app) and reject on HTTP errors.
 */
export function openRazorpayCheckout({
  post,
  payment,
  orderId,
  isOffline = false,
  name = 'Restaurant',
  description = '',
  prefill = {},
  themeColor = '#3A7D7C'
}) {
  const razorpayOrderId = payment.razorpayOrderId || payment.razorpay_order_id;
  const verifyBody = (extra) => ({ order_id: orderId, razorpay_order_id: razorpayOrderId, is_offline: isOffline, ...extra });
  const errorMessage = (err, fallback) =>
    err?.response?.data?.message || err?.message || fallback;

  const reportFailure = (reason) =>
    post('/payments/failed', { order_id: orderId, razorpay_order_id: razorpayOrderId, is_offline: isOffline, reason })
      .catch(() => {});

  // Local testing only: the server issues simulated payments when RAZORPAY_MOCK_MODE is on
  if (payment.isMock) {
    return post('/payments/verify', verifyBody({ razorpay_payment_id: `pay_mock_${Date.now()}`, razorpay_signature: 'mock' }))
      .then(() => ({ status: 'paid' }))
      .catch((err) => ({ status: 'failed', message: errorMessage(err, 'Payment failed.') }));
  }

  if (typeof window === 'undefined' || typeof window.Razorpay === 'undefined') {
    return Promise.resolve({
      status: 'failed',
      message: 'The payment window could not be loaded. Please check your internet connection and try again.'
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    let lastFailure = null;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const rzp = new window.Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      name,
      description,
      order_id: razorpayOrderId,
      prefill,
      theme: { color: themeColor },
      handler: async (response) => {
        try {
          await post('/payments/verify', verifyBody({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          }));
          finish({ status: 'paid' });
        } catch (err) {
          finish({ status: 'failed', message: errorMessage(err, 'We could not confirm your payment.') });
        }
      },
      modal: {
        ondismiss: () => {
          if (!settled) {
            if (lastFailure) {
              finish({ status: 'failed', message: lastFailure });
            } else {
              reportFailure('Payment window closed by customer');
              finish({ status: 'dismissed' });
            }
          }
        }
      }
    });

    // Razorpay keeps its window open after a failed attempt so the customer can retry, so
    // record the failure but keep waiting for a success or for the window to be closed.
    rzp.on('payment.failed', (response) => {
      lastFailure = response?.error?.description || 'Payment failed';
      reportFailure(lastFailure);
    });

    rzp.open();
  });
}

/** A fresh id for one checkout attempt (used as the order's idempotency key). */
export function newCheckoutKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
