import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Boxes,
  Camera,
  Instagram,
  Megaphone,
  ExternalLink,
  LogOut,
  Package,
  RotateCcw,
  ScrollText,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./Button";
import { VenusChat } from "./VenusChat";
import { useAuth } from "../helpers/useAuth";
import { useAdminCatalog } from "../helpers/useAdminCatalog";
import { LOW_STOCK_THRESHOLD } from "../helpers/stock";
import styles from "../pages/admin.module.css";
import local from "./AdminNav.module.css";

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin", label: "Produtos", icon: Package },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/estoque", label: "Estoque", icon: Boxes },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/trocas", label: "Trocas", icon: RotateCcw },
  { to: "/admin/avaliacoes", label: "Avaliações", icon: Star },
  { to: "/admin/avisos", label: "Avisos", icon: Bell },
  { to: "/admin/entrega", label: "Entrega", icon: Truck },
  { to: "/admin/venus", label: "Vênus", icon: Sparkles },
  { to: "/admin/publicacoes", label: "Publicações", icon: Megaphone },
  { to: "/admin/stories", label: "Stories", icon: Camera },
  { to: "/admin/instagram", label: "Instagram", icon: Instagram },
  { to: "/admin/registro", label: "Registro", icon: ScrollText },
];

/**
 * Cabeçalho de todas as páginas do painel: título e ações em cima, e embaixo as abas
 * (sempre as mesmas, na mesma ordem, com a aba aberta em destaque). `current` é o caminho da página aberta.
 */
export const AdminNav = ({ title, current }: { title: string; current: string }) => {
  const { logout } = useAuth();
  const { query } = useAdminCatalog();
  const tabsRef = useRef<HTMLElement>(null);

  // produtos esgotados ou acabando, entre os que aparecem no site
  const stockAlerts = (query.data?.products ?? []).filter(
    (p) => p.active && p.stockQuantity !== null && p.stockQuantity <= LOW_STOCK_THRESHOLD,
  ).length;

  // No celular a barra rola de lado: deixa a aba aberta visível.
  useEffect(() => {
    const barra = tabsRef.current;
    const ativa = barra?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!barra || !ativa) return;
    barra.scrollTo({ left: ativa.offsetLeft - (barra.clientWidth - ativa.clientWidth) / 2 });
  }, [current]);

  return (
    <header className={styles.header}>
      <div className={local.inner}>
        <div className={local.top}>
          <h1 className={local.title}>{title}</h1>
          <div className={local.actions}>
            <Button asChild variant="outline" size="sm">
              <Link to="/" aria-label="Ver o site">
                <ExternalLink size={16} /> <span className={local.actionText}>Ver site</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()} aria-label="Sair">
              <LogOut size={16} /> <span className={local.actionText}>Sair</span>
            </Button>
          </div>
        </div>
        <nav className={local.tabs} aria-label="Seções do painel" ref={tabsRef}>
          {tabs.map((t) => {
            const active = t.to === current;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`${local.tab} ${active ? local.tabActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <t.icon size={16} aria-hidden />
                <span>{t.label}</span>
                {t.to === "/admin/estoque" && stockAlerts > 0 ? (
                  <span className={local.badge} aria-label={`${stockAlerts} produtos acabando`}>
                    {stockAlerts}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* A Vênus como popup também no painel (na página da Vênus ela já ocupa a tela). */}
      {current !== "/admin/venus" ? <VenusChat /> : null}
    </header>
  );
};
