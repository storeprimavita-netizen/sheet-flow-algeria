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

export function useAddTransaction() {
  const fn = useServerFn(addTransaction);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}
export function useAddAccount() {
  const fn = useServerFn(addAccount);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}
export function useAddProduct() {
  const fn = useServerFn(addProduct);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}
export function useAddSpy() {
  const fn = useServerFn(addSpy);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}
export function useAddContact() {
  const fn = useServerFn(addContact);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}
export function useUpdateRate() {
  const fn = useServerFn(updateExchangeRate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof fn>[0]["data"]) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}
