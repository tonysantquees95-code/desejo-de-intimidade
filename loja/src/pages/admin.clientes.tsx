import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, MessageCircle } from "lucide-react";
import { AdminNav } from "../components/AdminNav";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../components/Dialog";
import { toast } from "../helpers/toast";
import { getAdminCustomers, type AdminCustomer } from "../endpoints/admin/customers_GET.schema";
import { postResetCode, type OutputType as ResetCodeResult } from "../endpoints/admin/reset_code_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.clientes.module.css";

function buildMessage(result: ResetCodeResult) {
  const first = result.displayName.trim().split(/\s+/)[0] ?? "";
  return `Olá, ${first}! Seu código para criar uma nova senha no site da Desejo de Intimidade é: ${result.code}\n\nDigite esse código na tela "Esqueci minha senha". Ele vale por ${result.expiresInMinutes} minutos. Se não foi você que pediu, ignore esta mensagem.`;
}

function whatsappLink(result: ResetCodeResult) {
  const digits = (result.phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(result))}`;
}

export default function AdminClientesPage() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<ResetCodeResult | null>(null);
  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => getAdminCustomers(),
  });

  const generate = useMutation({
    mutationFn: postResetCode,
    onSuccess: (r) => setResult(r),
    onError: (err) => toast.error(err.message),
  });

  const term = search.trim().toLowerCase();
  const customers = (data?.customers ?? []).filter(
    (c: AdminCustomer) =>
      !term ||
      c.displayName.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone ?? "").includes(term),
  );

  const copy = async (text: string, okMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMessage);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };

  const waLink = result ? whatsappLink(result) : null;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Clientes | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Clientes" current="/admin/clientes" />
      <main className={styles.main}>
        <p className={styles.hint}>
          Quando uma cliente pedir um código para a senha pelo WhatsApp, confira
          que a mensagem veio de quem é dona da conta, procure o nome ou e-mail
          abaixo e gere o código. Ele vale por 30 minutos e só funciona uma vez.
        </p>
        <Input
          value={search}
          placeholder="Buscar por nome, e-mail ou telefone"
          aria-label="Buscar cliente"
          onChange={(e) => setSearch(e.target.value)}
        />
        {isFetching && !data ? (
          <Skeleton className={local.skeleton} />
        ) : isError ? (
          <p className={styles.error}>Não foi possível carregar os clientes.</p>
        ) : customers.length === 0 ? (
          <p className={styles.empty}>Nenhuma cliente encontrada.</p>
        ) : (
          <ul className={local.list}>
            {customers.map((c) => (
              <li key={c.id} className={local.row}>
                <div className={local.info}>
                  <strong>{c.displayName}</strong>
                  <span className={local.meta}>{c.email}</span>
                  <span className={local.meta}>
                    {c.phone ? c.phone : "Sem telefone cadastrado"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generate.isPending}
                  onClick={() => generate.mutate({ userId: c.id })}
                >
                  <KeyRound size={16} /> Gerar código
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código para {result?.displayName}</DialogTitle>
            <DialogDescription>
              Envie este código pelo WhatsApp. Vale por {result?.expiresInMinutes}{" "}
              minutos. Gerar outro código anula este.
            </DialogDescription>
          </DialogHeader>
          <div className={local.code}>{result?.code}</div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => result && copy(buildMessage(result), "Mensagem copiada")}
            >
              <Copy size={16} /> Copiar mensagem
            </Button>
            {waLink ? (
              <Button asChild>
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={16} /> Enviar no WhatsApp
                </a>
              </Button>
            ) : (
              <Button onClick={() => result && copy(result.code, "Código copiado")}>
                <Copy size={16} /> Copiar só o código
              </Button>
            )}
          </DialogFooter>
          {!waLink ? (
            <p className={local.meta}>
              Esta cliente não tem telefone cadastrado. Cole a mensagem na
              conversa em que ela pediu o código.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}