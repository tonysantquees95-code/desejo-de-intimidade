import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Switch } from "./Switch";
import { Skeleton } from "./Skeleton";
import { toast } from "../helpers/toast";
import { parsePriceToCents } from "../helpers/parsePriceToCents";
import { shippingRegions } from "../helpers/shippingRegions";
import { FRETE_GRATIS_PADRAO } from "../helpers/shippingConfigSchema";
import { getShippingConfig } from "../endpoints/admin/shipping_config_GET.schema";
import { postShippingConfig } from "../endpoints/admin/shipping_config_POST.schema";
import styles from "../pages/admin.module.css";
import local from "../pages/admin.pedidos.module.css";

const centsToText = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

export function ShippingSettingsCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "shipping-config"],
    queryFn: () => getShippingConfig(),
  });
  const [rates, setRates] = useState<Record<string, { price: string; days: string }>>({});
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  const [motoboyEnabled, setMotoboyEnabled] = useState(true);
  const [motoboyBase, setMotoboyBase] = useState("7,00");
  const [motoboyPerKm, setMotoboyPerKm] = useState("2,00");
  const [motoboyMaxKm, setMotoboyMaxKm] = useState("30");
  const [sender, setSender] = useState({
    name: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    phone: "",
    email: "",
    document: "",
  });
  const [pkg, setPkg] = useState({
    weightGrams: "300",
    widthCm: "16",
    heightCm: "6",
    lengthCm: "20",
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, { price: string; days: string }> = {};
    for (const region of shippingRegions) {
      const rate = data.config.sedex[region.id];
      next[region.id] = { price: centsToText(rate.priceCents), days: String(rate.days) };
    }
    setRates(next);
    setPickupEnabled(data.config.pickup.enabled);
    setPickupAddress(data.config.pickup.address);
    setPickupNote(data.config.pickup.note);
    setMotoboyEnabled(data.config.motoboy.enabled);
    setMotoboyBase(centsToText(data.config.motoboy.baseCents));
    setMotoboyPerKm(centsToText(data.config.motoboy.perKmCents));
    setMotoboyMaxKm(String(data.config.motoboy.maxKm));
    setSender(data.config.sender);
    const p = data.config.defaultPackage;
    setPkg({
      weightGrams: String(p.weightGrams),
      widthCm: String(p.widthCm),
      heightCm: String(p.heightCm),
      lengthCm: String(p.lengthCm),
    });
  }, [data]);

  const save = useMutation({
    mutationFn: postShippingConfig,
    onSuccess: () => {
      toast("Entrega atualizada");
      queryClient.invalidateQueries({ queryKey: ["admin", "shipping-config"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const sedex = {} as NonNullable<typeof data>["config"]["sedex"];
    for (const region of shippingRegions) {
      const cents = parsePriceToCents(rates[region.id]?.price ?? "");
      const days = Number(rates[region.id]?.days);
      if (cents === null || !Number.isInteger(days) || days < 1) {
        toast.error(`Confira o valor e o prazo de ${region.label}.`);
        return;
      }
      sedex[region.id] = { priceCents: cents, days };
    }
    const defaultPackage = {
      weightGrams: Number(pkg.weightGrams),
      widthCm: Number(pkg.widthCm),
      heightCm: Number(pkg.heightCm),
      lengthCm: Number(pkg.lengthCm),
    };
    if (Object.values(defaultPackage).some((v) => !Number.isInteger(v) || v <= 0)) {
      toast.error("Confira o peso e o tamanho da caixa padrão.");
      return;
    }
    const baseCents = parsePriceToCents(motoboyBase);
    const perKmCents = parsePriceToCents(motoboyPerKm);
    const maxKm = Number(motoboyMaxKm);
    if (baseCents === null || perKmCents === null || !Number.isInteger(maxKm) || maxKm < 1) {
      toast.error("Confira a taxa, o valor por km e a distância máxima do motoboy.");
      return;
    }
    save.mutate({
      sedex,
      pickup: { enabled: pickupEnabled, address: pickupAddress, note: pickupNote },
      motoboy: { enabled: motoboyEnabled, baseCents, perKmCents, maxKm },
      sender,
      defaultPackage,
      // frete grátis (acima de R$ 180, a loja paga até R$ 30 do PAC no Sul, Sudeste e Centro-Oeste)
      freeShipping: FRETE_GRATIS_PADRAO,
    });
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Entrega e retirada</h2>
      <p className={styles.hint}>
        O frete (SEDEX e PAC) é calculado sozinho pelo Melhor Envio com o CEP
        do cliente. A tabela abaixo só é usada, como valor estimado, se o
        Melhor Envio estiver fora do ar.
      </p>
      {!data ? (
        <Skeleton className={local.skeleton} />
      ) : (
        <form onSubmit={handleSave} className={local.form}>
          {shippingRegions.map((region) => (
            <div key={region.id} className={local.rateRow}>
              <span className={local.regionLabel}>{region.label}</span>
              <Input
                aria-label={`Valor ${region.label}`}
                value={rates[region.id]?.price ?? ""}
                inputMode="decimal"
                placeholder="24,90"
                onChange={(e) =>
                  setRates((r) => ({ ...r, [region.id]: { ...r[region.id], price: e.target.value } }))
                }
              />
              <Input
                aria-label={`Prazo ${region.label}`}
                value={rates[region.id]?.days ?? ""}
                inputMode="numeric"
                placeholder="dias"
                onChange={(e) =>
                  setRates((r) => ({ ...r, [region.id]: { ...r[region.id], days: e.target.value } }))
                }
              />
            </div>
          ))}
          <div className={local.pickup}>
            <div className={local.pickupHead}>
              <strong>Entrega Expressa via Motoboy</strong>
              <Switch checked={motoboyEnabled} onCheckedChange={setMotoboyEnabled} />
            </div>
            <p className={styles.hint}>
              O valor é a taxa de saída mais o valor por km rodado, da loja (endereço do remetente
              abaixo) até o CEP do cliente. Ex.: 7,00 + 2,00 por km, a 5 km = R$ 17,00.
            </p>
            <Input
              aria-label="Taxa de saída do motoboy (R$)"
              value={motoboyBase}
              inputMode="decimal"
              placeholder="Taxa de saída (R$), ex.: 7,00"
              onChange={(e) => setMotoboyBase(e.target.value)}
            />
            <Input
              aria-label="Valor por km (R$)"
              value={motoboyPerKm}
              inputMode="decimal"
              placeholder="Valor por km (R$), ex.: 2,00"
              onChange={(e) => setMotoboyPerKm(e.target.value)}
            />
            <Input
              aria-label="Distância máxima do motoboy (km)"
              value={motoboyMaxKm}
              inputMode="numeric"
              placeholder="Distância máxima (km), ex.: 30"
              onChange={(e) => setMotoboyMaxKm(e.target.value)}
            />
          </div>
          <div className={local.pickup}>
            <div className={local.pickupHead}>
              <strong>Retirada em ponto de retirada</strong>
              <Switch checked={pickupEnabled} onCheckedChange={setPickupEnabled} />
            </div>
            <p className={styles.hint}>
              Aparece para o cliente no checkout. Não coloque o endereço exato:
              o local, o dia e o horário são combinados pelo WhatsApp depois da compra.
            </p>
            <Input
              aria-label="Região do ponto de retirada"
              value={pickupAddress}
              placeholder="Região (ex.: Ponto de retirada em Porto Alegre)"
              onChange={(e) => setPickupAddress(e.target.value)}
            />
            <Input
              aria-label="Aviso de retirada"
              value={pickupNote}
              placeholder="Aviso ao cliente (ex.: agende a retirada pelo WhatsApp após a compra)"
              onChange={(e) => setPickupNote(e.target.value)}
            />
          </div>
          <div className={local.pickup}>
            <strong>Remetente da etiqueta dos Correios</strong>
            <p className={styles.hint}>
              Aparece na etiqueta que você imprime. Use um nome discreto (o seu
              nome, por exemplo), sem citar o tipo de loja.
            </p>
            <Input
              aria-label="Nome do remetente"
              value={sender.name}
              placeholder="Nome do remetente"
              onChange={(e) => setSender((s) => ({ ...s, name: e.target.value }))}
            />
            <Input
              aria-label="Rua do remetente"
              value={sender.street}
              placeholder="Rua"
              onChange={(e) => setSender((s) => ({ ...s, street: e.target.value }))}
            />
            <div className={local.senderRow}>
              <Input
                aria-label="Número"
                value={sender.number}
                placeholder="Número"
                onChange={(e) => setSender((s) => ({ ...s, number: e.target.value }))}
              />
              <Input
                aria-label="Complemento"
                value={sender.complement}
                placeholder="Complemento"
                onChange={(e) => setSender((s) => ({ ...s, complement: e.target.value }))}
              />
              <Input
                aria-label="Bairro"
                value={sender.neighborhood}
                placeholder="Bairro"
                onChange={(e) => setSender((s) => ({ ...s, neighborhood: e.target.value }))}
              />
            </div>
            <div className={local.senderRow}>
              <Input
                aria-label="Cidade"
                value={sender.city}
                placeholder="Cidade"
                onChange={(e) => setSender((s) => ({ ...s, city: e.target.value }))}
              />
              <Input
                aria-label="UF"
                value={sender.state}
                maxLength={2}
                placeholder="UF"
                onChange={(e) => setSender((s) => ({ ...s, state: e.target.value.toUpperCase() }))}
              />
              <Input
                aria-label="CEP"
                value={sender.cep}
                inputMode="numeric"
                placeholder="CEP"
                onChange={(e) => setSender((s) => ({ ...s, cep: e.target.value }))}
              />
            </div>
          </div>
          <div className={local.pickup}>
            <strong>Dados para o Melhor Envio</strong>
            <p className={styles.hint}>
              O Melhor Envio exige telefone, e-mail e CPF ou CNPJ do remetente.
              Eles não aparecem para o cliente.
            </p>
            <div className={local.senderRow}>
              <Input
                aria-label="Telefone do remetente"
                value={sender.phone}
                inputMode="tel"
                placeholder="Telefone com DDD"
                onChange={(e) => setSender((s) => ({ ...s, phone: e.target.value }))}
              />
              <Input
                aria-label="E-mail do remetente"
                value={sender.email}
                inputMode="email"
                placeholder="E-mail"
                onChange={(e) => setSender((s) => ({ ...s, email: e.target.value }))}
              />
              <Input
                aria-label="CPF ou CNPJ do remetente"
                value={sender.document}
                inputMode="numeric"
                placeholder="CPF ou CNPJ"
                onChange={(e) => setSender((s) => ({ ...s, document: e.target.value }))}
              />
            </div>
            <strong>Caixa padrão</strong>
            <p className={styles.hint}>
              Usada quando um produto não tem peso e tamanho próprios. Peso em
              gramas, medidas em cm.
            </p>
            <div className={local.pkgRow}>
              <Input aria-label="Peso (g)" value={pkg.weightGrams} inputMode="numeric" placeholder="Peso (g)" onChange={(e) => setPkg((p) => ({ ...p, weightGrams: e.target.value }))} />
              <Input aria-label="Comprimento (cm)" value={pkg.lengthCm} inputMode="numeric" placeholder="Comprim." onChange={(e) => setPkg((p) => ({ ...p, lengthCm: e.target.value }))} />
              <Input aria-label="Largura (cm)" value={pkg.widthCm} inputMode="numeric" placeholder="Largura" onChange={(e) => setPkg((p) => ({ ...p, widthCm: e.target.value }))} />
              <Input aria-label="Altura (cm)" value={pkg.heightCm} inputMode="numeric" placeholder="Altura" onChange={(e) => setPkg((p) => ({ ...p, heightCm: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" disabled={save.isPending}>
            <Save size={16} /> {save.isPending ? "Salvando..." : "Salvar entrega"}
          </Button>
        </form>
      )}
    </section>
  );
}