"use client";
import { persistor, store } from "./store";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { QueryProvider } from "@/lib/query-provider";

export function Providers({ children }: { children: any }) {
  if (!persistor) {
    return (
      <Provider store={store}>
        <QueryProvider>{children}</QueryProvider>
      </Provider>
    );
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryProvider>{children}</QueryProvider>
      </PersistGate>
    </Provider>
  );
}
