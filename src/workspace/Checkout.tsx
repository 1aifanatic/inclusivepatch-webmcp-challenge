import { AlertTriangle, Check, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { BASELINE_CONFIG, SYNTHETIC_CHECKOUT } from "../checkout/checkoutFixture";
import type { CheckoutAccessibilityConfig } from "../domain/types";

interface CheckoutProps {
  config: CheckoutAccessibilityConfig;
  selectedComponentId: string | null;
  viewingBaseline: boolean;
}

function IssueMarker({ id }: { id: string }) {
  return (
    <span className="issue-marker" aria-label={`Issue marker ${id}`}>
      {id.slice(-3)}
    </span>
  );
}

export function Checkout({ config, selectedComponentId, viewingBaseline }: CheckoutProps) {
  const [delivery, setDelivery] = useState("standard");
  const [paymentError, setPaymentError] = useState(false);
  const [trapNotice, setTrapNotice] = useState(false);
  const effectiveConfig = viewingBaseline ? BASELINE_CONFIG : config;

  const selectedClass = (componentId: string) =>
    selectedComponentId === componentId ? "component-selected" : "";

  const handleDeliveryKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (effectiveConfig.deliveryKeyboardTrapEnabled && event.key === "Tab") {
      event.preventDefault();
      setTrapNotice(true);
    }
    if (event.key === "Escape") {
      setTrapNotice(false);
      document.getElementById("payment-card")?.focus();
    }
  };

  return (
    <section aria-labelledby="checkout-title" className="checkout-shell">
      <div className="checkout-brandbar">
        <div>
          <p className="eyebrow text-[#5d6d67]">Northstar Goods</p>
          <h2 id="checkout-title" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#17231f]">
            Secure checkout
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#52645f]">
          <LockKeyhole aria-hidden="true" size={14} /> Synthetic order
        </div>
      </div>

      <div className="fixture-note" role="note">
        <AlertTriangle aria-hidden="true" size={16} />
        <span>
          Controlled demo fixture. {viewingBaseline ? "Showing the frozen baseline snapshot." : "Issue markers reflect the current scan."}
        </span>
      </div>

      <form
        id="checkout-fixture"
        className="space-y-7 px-5 pb-7 pt-6 sm:px-7"
        onSubmit={(event) => {
          event.preventDefault();
          setPaymentError(true);
        }}
      >
        <section aria-labelledby="contact-heading">
          <div className="section-kicker">
            <span>01</span>
            <h3 id="contact-heading">Contact</h3>
          </div>
          <div className={`relative mt-4 ${selectedClass("checkout-email")}`}>
            {effectiveConfig.emailLabelEnabled ? (
              <label className="field-label" htmlFor="checkout-email">
                Email address
              </label>
            ) : (
              <p className="field-label">Email address</p>
            )}
            <input
              className="checkout-input"
              id="checkout-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              defaultValue={SYNTHETIC_CHECKOUT.customer.email}
            />
            {!effectiveConfig.emailLabelEnabled && <IssueMarker id="A11Y-001" />}
          </div>
        </section>

        <section aria-labelledby="shipping-heading">
          <div className="section-kicker">
            <span>02</span>
            <h3 id="shipping-heading">Shipping</h3>
          </div>
          <div className={`relative mt-4 ${selectedClass("shipping-address")}`}>
            <label className="field-label" htmlFor="shipping-address">
              Street address
            </label>
            <input
              className="checkout-input"
              id="shipping-address"
              name="address"
              tabIndex={effectiveConfig.focusOrderMode === "broken" ? -1 : 0}
              defaultValue={SYNTHETIC_CHECKOUT.customer.address}
            />
            {effectiveConfig.focusOrderMode === "broken" && <IssueMarker id="A11Y-002" />}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="shipping-city">City</label>
              <input className="checkout-input" id="shipping-city" defaultValue={SYNTHETIC_CHECKOUT.customer.city} />
            </div>
            <div>
              <label className="field-label" htmlFor="shipping-postal">ZIP code</label>
              <input className="checkout-input" id="shipping-postal" defaultValue={SYNTHETIC_CHECKOUT.customer.postalCode} />
            </div>
          </div>
          <p
            id="shipping-helper"
            className={`relative mt-2 text-xs ${
              effectiveConfig.helperTextToken === "accessible" ? "text-[#52645f]" : "text-[#a5afa9]"
            } ${selectedClass("shipping-helper")}`}
          >
            We use this address only to calculate delivery.
            {effectiveConfig.helperTextToken === "low-contrast" && <IssueMarker id="A11Y-005" />}
          </p>
        </section>

        <fieldset
          id="delivery-options"
          className={`relative rounded-2xl border border-[#d9e1dd] p-4 ${selectedClass("delivery-options")}`}
          onKeyDown={handleDeliveryKeyDown}
        >
          <legend className="px-1 text-sm font-semibold text-[#24332e]">Delivery method</legend>
          <label className="delivery-option">
            <input
              checked={delivery === "standard"}
              name="delivery"
              onChange={() => setDelivery("standard")}
              type="radio"
              value="standard"
            />
            <span>
              <strong>Standard</strong>
              <small>3–5 business days</small>
            </span>
            <b>$5</b>
          </label>
          <label className="delivery-option">
            <input
              checked={delivery === "express"}
              name="delivery"
              onChange={() => setDelivery("express")}
              type="radio"
              value="express"
            />
            <span>
              <strong>Express</strong>
              <small>1–2 business days</small>
            </span>
            <b>$14</b>
          </label>
          {effectiveConfig.deliveryKeyboardTrapEnabled && <IssueMarker id="A11Y-003" />}
          {trapNotice && (
            <p className="mt-3 rounded-lg bg-[#fff3e4] px-3 py-2 text-xs font-medium text-[#8a4b10]" role="alert">
              Demo trap detected. Press Escape to move safely to payment.
            </p>
          )}
        </fieldset>

        <section aria-labelledby="payment-heading">
          <div className="section-kicker">
            <span>03</span>
            <h3 id="payment-heading">Payment</h3>
          </div>
          <div className={`relative mt-4 ${selectedClass("payment-card")}`}>
            <label className="field-label" htmlFor="payment-card">Card number</label>
            <input
              aria-describedby={effectiveConfig.announceValidationErrors && paymentError ? "payment-error" : undefined}
              className="checkout-input"
              id="payment-card"
              inputMode="numeric"
              placeholder="4242 4242 4242 4242"
            />
            {!effectiveConfig.announceValidationErrors && <IssueMarker id="A11Y-004" />}
            {paymentError && (
              <p
                className="mt-2 text-sm font-medium text-[#a63825]"
                id="payment-error"
                role={effectiveConfig.announceValidationErrors ? "status" : undefined}
              >
                Enter a card number to continue.
              </p>
            )}
          </div>
        </section>

        <div className="rounded-2xl bg-[#f4f6f3] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#476257] shadow-sm">
                <PackageCheck aria-hidden="true" size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#22312c]">{SYNTHETIC_CHECKOUT.order.item}</p>
                <p className="mt-0.5 text-xs text-[#6d7b76]">Qty {SYNTHETIC_CHECKOUT.order.quantity}</p>
              </div>
            </div>
            <strong className="text-sm text-[#22312c]">{SYNTHETIC_CHECKOUT.order.total}</strong>
          </div>
        </div>

        <button
          aria-label={effectiveConfig.continueAccessibleName ?? undefined}
          className={`relative flex w-full items-center justify-center gap-2 rounded-xl bg-[#172c26] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(23,44,38,.18)] transition hover:bg-[#23483c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#dd7a32] ${selectedClass("continue-action")}`}
          id="continue-action"
          type="submit"
        >
          Continue <Check aria-hidden="true" size={16} />
          {!effectiveConfig.continueAccessibleName && <IssueMarker id="A11Y-006" />}
        </button>

        <p className="flex items-center justify-center gap-2 text-center text-xs text-[#6d7b76]">
          <ShieldCheck aria-hidden="true" size={14} /> No payment or personal data leaves this browser.
        </p>
      </form>
    </section>
  );
}
