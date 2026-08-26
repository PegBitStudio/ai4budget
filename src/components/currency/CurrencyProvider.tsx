"use client";

import { createContext, useContext } from "react";
import { setActiveCurrencySymbol } from "@/utils/formatters";
import { currencyByCode, type Currency } from "@/config/currencies";

const CurrencyContext = createContext<Currency>(currencyByCode(null));

/**
 * Sets the currency for everything below it.
 *
 * The symbol is pushed into the formatter module *during render* rather than in
 * an effect. An effect runs after the first paint, which would show every
 * amount in the wrong currency for a frame — on a page of figures that flash is
 * exactly the kind of thing that makes a money product feel untrustworthy.
 *
 * Writing during render is safe here because the write is idempotent and the
 * value comes from a server-rendered prop, not from state.
 */
export function CurrencyProvider({
  code,
  children,
}: {
  code: string | null | undefined;
  children: React.ReactNode;
}) {
  const currency = currencyByCode(code);
  setActiveCurrencySymbol(currency.symbol);

  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** The active currency, for the few places that need more than the symbol. */
export function useCurrency(): Currency {
  return useContext(CurrencyContext);
}
