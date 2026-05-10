import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  fetchAll,
  addTransaction,
  addAccount,
  addProduct,
  addSpy,
  addContact,
  updateExchangeRate,
} from "@/lib/sheets.functions";

export function useSheetsData() {
  const fn = useServerFn(fetchAll);
  return useQuery({
    queryKey: ["sheets"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

function makeMutation<T>(serverFn: (opts: { data: T }) => Promise<any>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: T) => serverFn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}

export function useAddTransaction() {
  const fn = useServerFn(addTransaction);
  return makeMutation<any>(fn as any);
}
export function useAddAccount() {
  const fn = useServerFn(addAccount);
  return makeMutation<any>(fn as any);
}
export function useAddProduct() {
  const fn = useServerFn(addProduct);
  return makeMutation<any>(fn as any);
}
export function useAddSpy() {
  const fn = useServerFn(addSpy);
  return makeMutation<any>(fn as any);
}
export function useAddContact() {
  const fn = useServerFn(addContact);
  return makeMutation<any>(fn as any);
}
export function useUpdateRate() {
  const fn = useServerFn(updateExchangeRate);
  return makeMutation<any>(fn as any);
}
