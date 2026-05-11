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
  updateAccount,
  updateProduct,
  updateContact,
  reverseTransaction,
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
  return makeMutation<any>(useServerFn(addTransaction) as any);
}
export function useAddAccount() {
  return makeMutation<any>(useServerFn(addAccount) as any);
}
export function useAddProduct() {
  return makeMutation<any>(useServerFn(addProduct) as any);
}
export function useAddSpy() {
  return makeMutation<any>(useServerFn(addSpy) as any);
}
export function useAddContact() {
  return makeMutation<any>(useServerFn(addContact) as any);
}
export function useUpdateRate() {
  return makeMutation<any>(useServerFn(updateExchangeRate) as any);
}
export function useUpdateAccount() {
  return makeMutation<any>(useServerFn(updateAccount) as any);
}
export function useUpdateProduct() {
  return makeMutation<any>(useServerFn(updateProduct) as any);
}
export function useUpdateContact() {
  return makeMutation<any>(useServerFn(updateContact) as any);
}
export function useReverseTransaction() {
  return makeMutation<any>(useServerFn(reverseTransaction) as any);
}
